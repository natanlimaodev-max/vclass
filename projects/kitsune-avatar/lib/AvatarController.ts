import type { VRM } from "@pixiv/three-vrm";
import { VRMHumanBoneName } from "@pixiv/three-vrm";

export class AvatarController {
  private vrm: VRM;
  private blinkTimer = 0;
  private nextBlink = this.randomBlinkInterval();

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.applyRestPose();
  }

  private applyRestPose() {
    const set = (name: VRMHumanBoneName, rot: { x?: number; y?: number; z?: number }) => {
      const bone = this.vrm.humanoid?.getNormalizedBoneNode(name);
      if (!bone) return;
      if (rot.x !== undefined) bone.rotation.x = rot.x;
      if (rot.y !== undefined) bone.rotation.y = rot.y;
      if (rot.z !== undefined) bone.rotation.z = rot.z;
    };
    set(VRMHumanBoneName.LeftUpperArm,  { z:  1.2 });
    set(VRMHumanBoneName.RightUpperArm, { z: -1.2 });
    set(VRMHumanBoneName.LeftLowerArm,  { z:  0.2 });
    set(VRMHumanBoneName.RightLowerArm, { z: -0.2 });
  }

  setMouth(value: number) {
    this.vrm.expressionManager?.setValue("aa", Math.max(0, Math.min(1, value)));
  }

  update(deltaTime: number) {
    this.blinkTimer += deltaTime;
    if (this.blinkTimer >= this.nextBlink) {
      const mgr = this.vrm.expressionManager;
      if (mgr) {
        mgr.setValue("blink", 1);
        setTimeout(() => mgr.setValue("blink", 0), 120);
      }
      this.blinkTimer = 0;
      this.nextBlink = this.randomBlinkInterval();
    }
    this.vrm.update(deltaTime);
  }

  private randomBlinkInterval() {
    return 2 + Math.random() * 4;
  }
}
