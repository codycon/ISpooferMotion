import type { ParsedAssetRef, RobloxAssetType } from './types';

// Asset ID extraction

const ASSET_URL_PATTERNS = [
  /^rbxassetid:\/\/(\d+)/i,
  /[?&]id=(\d+)/i,
  /^(\d{4,})$/, // bare numeric ID (min 4 digits to reduce false positives)
];

/**
 * Extract a plain numeric asset ID from any of the supported Roblox URL
 * formats.  Returns `null` if the value does not look like an asset reference.
 */
export function extractAssetId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const pattern of ASSET_URL_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) return m[1];
  }

  return null;
}

// Property -> asset type mapping

/**
 * Maps `"ClassName.PropertyName"` to an asset type.
 * Checked in order; first match wins.
 * Wildcard class key `"*.PropertyName"` is used for properties that carry
 * the same semantic regardless of class.
 */
const PROPERTY_MAP: Array<{
  className: string | null; // null = any class
  property: string;
  type: RobloxAssetType;
}> = [
  // Animations
  { className: 'Animation', property: 'AnimationId', type: 'animation' },
  { className: 'AnimationTrack', property: 'AnimationId', type: 'animation' },
  { className: null, property: 'AnimationId', type: 'animation' },

  // Audio
  { className: 'Sound', property: 'SoundId', type: 'audio' },
  { className: null, property: 'SoundId', type: 'audio' },

  // Images
  { className: 'Decal', property: 'Texture', type: 'image' },
  { className: 'Texture', property: 'Texture', type: 'image' },
  { className: 'ImageLabel', property: 'Image', type: 'image' },
  { className: 'ImageButton', property: 'Image', type: 'image' },
  { className: 'SpecialMesh', property: 'TextureId', type: 'image' },
  { className: 'FileMesh', property: 'TextureId', type: 'image' },
  { className: null, property: 'TextureId', type: 'image' },
  { className: 'Sky', property: 'SkyboxBk', type: 'image' },
  { className: 'Sky', property: 'SkyboxDn', type: 'image' },
  { className: 'Sky', property: 'SkyboxFt', type: 'image' },
  { className: 'Sky', property: 'SkyboxLf', type: 'image' },
  { className: 'Sky', property: 'SkyboxRt', type: 'image' },
  { className: 'Sky', property: 'SkyboxUp', type: 'image' },

  // Meshes
  { className: 'MeshPart', property: 'MeshId', type: 'mesh' },
  { className: 'SpecialMesh', property: 'MeshId', type: 'mesh' },
  { className: 'FileMesh', property: 'MeshId', type: 'mesh' },
  { className: null, property: 'MeshId', type: 'mesh' },

  // Script references
  { className: 'Script', property: 'LinkedSource', type: 'script_ref' },
  { className: 'LocalScript', property: 'LinkedSource', type: 'script_ref' },
  { className: 'ModuleScript', property: 'LinkedSource', type: 'script_ref' },
  { className: null, property: 'LinkedSource', type: 'script_ref' },

  // Videos
  { className: 'VideoFrame', property: 'Video', type: 'video' },
  { className: null, property: 'Video', type: 'video' },
];

export function classifyProperty(className: string, propertyName: string): RobloxAssetType | null {
  for (const entry of PROPERTY_MAP) {
    if (entry.className !== null && entry.className !== className) continue;
    if (entry.property !== propertyName) continue;
    return entry.type;
  }
  return null;
}

// Asset ref builder

export function buildAssetRef(
  className: string,
  instanceName: string,
  propertyName: string,
  rawValue: string,
  assetId: string,
  path: string,
  type: RobloxAssetType,
): ParsedAssetRef {
  return {
    type,
    assetId,
    rawValue,
    className,
    instanceName,
    propertyName,
    path,
  };
}
