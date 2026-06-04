export async function playWithLipSync(
  audioBlob: Blob,
  onMouth: (value: number) => void
): Promise<void> {
  const audioCtx = new AudioContext();
  await audioCtx.resume();

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const source = audioCtx.createBufferSource();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;

  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  source.buffer = audioBuffer;

  // Time-domain: 128 = silence, deviations = sound
  const data = new Uint8Array(analyser.fftSize);
  let ended = false;
  let mouth = 0;

  return new Promise<void>((resolve) => {
    source.onended = () => {
      ended = true;
      onMouth(0);
      audioCtx.close();
      resolve();
    };

    source.start();

    const animate = () => {
      if (ended) return;

      analyser.getByteTimeDomainData(data);

      // RMS deviation from 128 (silence)
      const rms = Math.sqrt(
        data.reduce((sum, v) => sum + Math.pow((v - 128) / 128, 2), 0) / data.length
      );

      // Threshold: ignore noise floor; smooth with lerp
      const target = rms > 0.02 ? Math.min(1, rms * 8) : 0;
      mouth += (target - mouth) * 0.3;

      onMouth(mouth);
      requestAnimationFrame(animate);
    };
    animate();
  });
}
