/**
 * Roblox R6 and R15 rig definitions using exact Motor6D C0/C1 values.
 *
 * R6:  Exact values captured verbatim from a stock Roblox R6 dummy in Studio.
 * R15: C0/C1 derived from exact RigAttachment positions captured from Studio
 *      (the attachment position in Part0 = C0, in Part1 = C1, identity rotation).
 *
 * Motor6D formula: Part1.CFrame = Part0.CFrame * C0 * Transform * C1:Inverse()
 */

export interface RigBone {
  name: string;
  parent: string | null;
  c0: number[];
  c1: number[];
  size: [number, number, number];
}

export type RigType = 'R6' | 'R15';

// Identity 3×3 rotation matrix (row-major)
const IDR = [1, 0, 0, 0, 1, 0, 0, 0, 1];

//
// R6 Rig - exact Motor6D C0/C1 captured from a stock R6 dummy
//
export const R6_BONES: RigBone[] = [
  {
    name: 'HumanoidRootPart',
    parent: null,
    c0: [0, 0, 0, ...IDR],
    c1: [0, 0, 0, ...IDR],
    size: [2, 2, 1],
  },
  {
    name: 'Torso',
    parent: 'HumanoidRootPart',
    c0: [0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0],
    c1: [0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0],
    size: [2, 2, 1],
  },
  {
    name: 'Head',
    parent: 'Torso',
    c0: [0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0],
    c1: [0, -0.5, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0],
    size: [1.2, 1.2, 1.2],
  },
  {
    name: 'Right Arm',
    parent: 'Torso',
    c0: [1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0],
    c1: [-0.5, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0],
    size: [1, 2, 1],
  },
  {
    name: 'Left Arm',
    parent: 'Torso',
    c0: [-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0],
    c1: [0.5, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0],
    size: [1, 2, 1],
  },
  {
    name: 'Right Leg',
    parent: 'Torso',
    c0: [1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0],
    c1: [0.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0],
    size: [1, 2, 1],
  },
  {
    name: 'Left Leg',
    parent: 'Torso',
    c0: [-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0],
    c1: [-0.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0],
    size: [1, 2, 1],
  },
];

//
// R15 Rig - exact RigAttachment positions from a stock R15 block dummy.
//
// All joints use identity rotation (standard R15 block rig).
// C0 = attachment world-position relative to PARENT part centre.
// C1 = attachment world-position relative to CHILD  part centre.
//
// Exact part sizes from Studio:
//   HumanoidRootPart:  2      × 2      × 1
//   LowerTorso:        2      × 0.4    × 1
//   UpperTorso:        2      × 1.6    × 1
//   Head:              1.196  × 1.203  × 1.198  (≈ 1.2 cube)
//   UpperArm:          1      × 1.169  × 1
//   LowerArm:          1      × 1.052  × 1
//   Hand:              1      × 0.300  × 1
//   UpperLeg:          1      × 1.217  × 1
//   LowerLeg:          1      × 1.193  × 1
//   Foot:              1      × 0.300  × 1
//
export const R15_BONES: RigBone[] = [
  // Root
  // HRP.RootRigAttachment = (0, -1, 0)  →  bottom of 2-unit tall HRP
  // LowerTorso.RootRigAttachment = (0, -0.2, 0)  → bottom of 0.4-unit LowerTorso
  {
    name: 'HumanoidRootPart',
    parent: null,
    c0: [0, 0, 0, ...IDR],
    c1: [0, 0, 0, ...IDR],
    size: [2, 2, 1],
  },
  {
    name: 'LowerTorso',
    parent: 'HumanoidRootPart',
    c0: [0, -1, 0, ...IDR], // RootRigAttachment in HRP
    c1: [0, -0.2, 0, ...IDR], // RootRigAttachment in LowerTorso
    size: [2, 0.4, 1],
  },

  // Torso
  // LowerTorso.WaistRigAttachment = (0, 0.2, 0)
  // UpperTorso.WaistRigAttachment = (0, -0.8, 0)
  {
    name: 'UpperTorso',
    parent: 'LowerTorso',
    c0: [0, 0.2, 0, ...IDR],
    c1: [0, -0.8, 0, ...IDR],
    size: [2, 1.6, 1],
  },

  // UpperTorso.NeckRigAttachment = (0, 0.8, 0)
  // Head.NeckRigAttachment = (0, -0.586, 0)
  {
    name: 'Head',
    parent: 'UpperTorso',
    c0: [0, 0.8, 0, ...IDR],
    c1: [0, -0.586, 0, ...IDR],
    size: [1.2, 1.2, 1.2],
  },

  // Left arm
  // UpperTorso.LeftShoulderRigAttachment  = (-1,    0.563, 0)
  // LeftUpperArm.LeftShoulderRigAttachment = ( 0.5,  0.394, 0)
  {
    name: 'LeftUpperArm',
    parent: 'UpperTorso',
    c0: [-1, 0.563, 0, ...IDR],
    c1: [0.5, 0.394, 0, ...IDR],
    size: [1, 1.169, 1],
  },
  // LeftUpperArm.LeftElbowRigAttachment  = (0, -0.334, 0)
  // LeftLowerArm.LeftElbowRigAttachment  = (0,  0.259, 0)
  {
    name: 'LeftLowerArm',
    parent: 'LeftUpperArm',
    c0: [0, -0.334, 0, ...IDR],
    c1: [0, 0.259, 0, ...IDR],
    size: [1, 1.052, 1],
  },
  // LeftLowerArm.LeftWristRigAttachment = (0, -0.501, 0)
  // LeftHand.LeftWristRigAttachment     = (0,  0.125, 0)
  {
    name: 'LeftHand',
    parent: 'LeftLowerArm',
    c0: [0, -0.501, 0, ...IDR],
    c1: [0, 0.125, 0, ...IDR],
    size: [1, 0.3, 1],
  },

  // Right arm
  // UpperTorso.RightShoulderRigAttachment  = (1,    0.563, 0)
  // RightUpperArm.RightShoulderRigAttachment = (-0.5, 0.394, 0)
  {
    name: 'RightUpperArm',
    parent: 'UpperTorso',
    c0: [1, 0.563, 0, ...IDR],
    c1: [-0.5, 0.394, 0, ...IDR],
    size: [1, 1.169, 1],
  },
  {
    name: 'RightLowerArm',
    parent: 'RightUpperArm',
    c0: [0, -0.334, 0, ...IDR],
    c1: [0, 0.259, 0, ...IDR],
    size: [1, 1.052, 1],
  },
  {
    name: 'RightHand',
    parent: 'RightLowerArm',
    c0: [0, -0.501, 0, ...IDR],
    c1: [0, 0.125, 0, ...IDR],
    size: [1, 0.3, 1],
  },

  // Left leg
  // LowerTorso.LeftHipRigAttachment     = (-0.5, -0.2,  0)
  // LeftUpperLeg.LeftHipRigAttachment   = ( 0,    0.421, 0)
  {
    name: 'LeftUpperLeg',
    parent: 'LowerTorso',
    c0: [-0.5, -0.2, 0, ...IDR],
    c1: [0, 0.421, 0, ...IDR],
    size: [1, 1.217, 1],
  },
  // LeftUpperLeg.LeftKneeRigAttachment  = (0, -0.401, 0)
  // LeftLowerLeg.LeftKneeRigAttachment  = (0,  0.379, 0)
  {
    name: 'LeftLowerLeg',
    parent: 'LeftUpperLeg',
    c0: [0, -0.401, 0, ...IDR],
    c1: [0, 0.379, 0, ...IDR],
    size: [1, 1.193, 1],
  },
  // LeftLowerLeg.LeftAnkleRigAttachment = (0, -0.547, 0)
  // LeftFoot.LeftAnkleRigAttachment     = (0,  0.102, 0)
  {
    name: 'LeftFoot',
    parent: 'LeftLowerLeg',
    c0: [0, -0.547, 0, ...IDR],
    c1: [0, 0.102, 0, ...IDR],
    size: [1, 0.3, 1],
  },

  // Right leg
  {
    name: 'RightUpperLeg',
    parent: 'LowerTorso',
    c0: [0.5, -0.2, 0, ...IDR],
    c1: [0, 0.421, 0, ...IDR],
    size: [1, 1.217, 1],
  },
  {
    name: 'RightLowerLeg',
    parent: 'RightUpperLeg',
    c0: [0, -0.401, 0, ...IDR],
    c1: [0, 0.379, 0, ...IDR],
    size: [1, 1.193, 1],
  },
  {
    name: 'RightFoot',
    parent: 'RightLowerLeg',
    c0: [0, -0.547, 0, ...IDR],
    c1: [0, 0.102, 0, ...IDR],
    size: [1, 0.3, 1],
  },
];

export function getBones(rigType: RigType): RigBone[] {
  return rigType === 'R6' ? R6_BONES : R15_BONES;
}

export function detectRigType(poseNames: Set<string>): RigType {
  const r15Bones = new Set([
    'LowerTorso',
    'UpperTorso',
    'LeftUpperArm',
    'RightUpperArm',
    'LeftUpperLeg',
    'RightUpperLeg',
  ]);
  for (const name of r15Bones) {
    if (poseNames.has(name)) return 'R15';
  }
  return 'R6';
}
