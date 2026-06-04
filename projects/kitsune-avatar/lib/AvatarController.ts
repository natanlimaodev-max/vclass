import type { VRM } from "@pixiv/three-vrm";
import { VRMHumanBoneName } from "@pixiv/three-vrm";

export type ExpressionName =
  | "happy"
  | "sad"
  | "surprised"
  | "angry"
  | "relaxed"
  | "aa"
  | "ih"
  | "ou"
  | "ee"
  | "oh"
  | "blink"
  | "blinkLeft"
  | "blinkRight";

export class AvatarController {
  private vrm: VRM;
  private blinkTimer = 0;
  private nextBlink = this.randomBlinkInterval();

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.applyRestPose();
  }

  private applyRestPose() {
    // Normalized bone space: left arm points +X, right arm points -X
    // Positive Z rotation = counterclockwise from front = arm goes UP for left arm
    // So to lower arms: left = -Z, right = +Z
    this.setBoneRotation(VRMHumanBoneName.LeftUpperArm,  { z:  1.2 });
    this.setBoneRotation(VRMHumanBoneName.RightUpperArm, { z: -1.2 });
    this.setBoneRotation(VRMHumanBoneName.LeftLowerArm,  { z:  0.2 });
    this.setBoneRotation(VRMHumanBoneName.RightLowerArm, { z: -0.2 });
  }

  setExpression(name: ExpressionName, value: number) {
    this.vrm.expressionManager?.setValue(name, Math.max(0, Math.min(1, value)));
  }

  resetExpressions() {
    const expressions: ExpressionName[] = [
      "happy", "sad", "surprised", "angry", "relaxed",
      "aa", "ih", "ou", "ee", "oh",
    ];
    for (const name of expressions) {
      this.vrm.expressionManager?.setValue(name, 0);
    }
  }

  setBoneRotation(
    boneName: VRMHumanBoneName,
    rotation: { x?: number; y?: number; z?: number }
  ) {
    const bone = this.vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (!bone) return;
    if (rotation.x !== undefined) bone.rotation.x = rotation.x;
    if (rotation.y !== undefined) bone.rotation.y = rotation.y;
    if (rotation.z !== undefined) bone.rotation.z = rotation.z;
  }

  // Called every frame from the render loop
  update(deltaTime: number) {
    this.blinkTimer += deltaTime;
    if (this.blinkTimer >= this.nextBlink) {
      this.triggerBlink();
      this.blinkTimer = 0;
      this.nextBlink = this.randomBlinkInterval();
    }
    this.vrm.update(deltaTime);
  }

  private triggerBlink() {
    const mgr = this.vrm.expressionManager;
    if (!mgr) return;
    mgr.setValue("blink", 1);
    setTimeout(() => mgr.setValue("blink", 0), 120);
  }

  private randomBlinkInterval() {
    // blink every 2–6 seconds
    return 2 + Math.random() * 4;
  }
}
