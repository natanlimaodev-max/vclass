"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { loadVRM } from "@/lib/vrm";
import { AvatarController } from "@/lib/AvatarController";

export interface AvatarCanvasHandle {
  controller: AvatarController | null;
}

interface Props {
  modelUrl?: string;
}

const AvatarCanvas = forwardRef<AvatarCanvasHandle, Props>(
  ({ modelUrl = "/models/Arisa/_VRM/Arisa.vrm" }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<AvatarController | null>(null);

    useImperativeHandle(ref, () => ({
      get controller() {
        return controllerRef.current;
      },
    }));

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      // Scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        15,
        mount.clientWidth / mount.clientHeight,
        0.1,
        20
      );
      camera.position.set(0, 1.28, 1.7);
      camera.lookAt(0, 1.45, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.display = "block";
      mount.appendChild(renderer.domElement);

      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);
      const directional = new THREE.DirectionalLight(0xffffff, 1.2);
      directional.position.set(1, 2, 2);
      scene.add(directional);

      // Clock
      const clock = new THREE.Clock();
      let animFrameId: number;

      // Load VRM
      loadVRM(modelUrl)
        .then((vrm) => {
          scene.add(vrm.scene);
          controllerRef.current = new AvatarController(vrm);
        })
        .catch((err) => {
          console.warn("VRM not loaded:", err.message);
        });

      // Render loop
      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        controllerRef.current?.update(delta);
        renderer.render(scene, camera);
      };
      animate();

      // Resize — observe the mount div directly so panel drags trigger it too
      const onResize = () => {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(mount);

      return () => {
        cancelAnimationFrame(animFrameId);
        ro.disconnect();
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    }, [modelUrl]);

    return <div ref={mountRef} className="w-full h-full" />;
  }
);

AvatarCanvas.displayName = "AvatarCanvas";
export default AvatarCanvas;
