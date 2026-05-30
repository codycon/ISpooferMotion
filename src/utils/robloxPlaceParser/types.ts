// Asset type classification

export type RobloxAssetType =
  | 'animation'
  | 'audio'
  | 'image'
  | 'mesh'
  | 'script_ref'
  | 'video'
  | 'unknown';

// Parsed asset reference

/**
 * A single resolved asset reference extracted from a Roblox place file.
 */
export interface ParsedAssetRef {
  /** Broad category of this asset. */
  type: RobloxAssetType;

  /** Normalised numeric asset ID (digits only, no URL prefix). */
  assetId: string;

  /** The raw string value as it appeared in the file. */
  rawValue: string;

  /** The Roblox class name of the instance that owns this property (e.g. "Sound"). */
  className: string;

  /** The `Name` property value of the owning instance (e.g. "BackgroundMusic"). */
  instanceName: string;

  /** The property name within the instance (e.g. "SoundId"). */
  propertyName: string;

  /**
   * Slash-separated hierarchy path from the root of the place tree.
   * e.g. "Workspace/SoundService/BackgroundMusic"
   */
  path: string;
}

// Parser result

export type RobloxFileType = 'rbxlx' | 'rbxl' | 'unknown';

export interface ParseProgress {
  phase: string;
  current: number;
  total: number;
  eta?: string;
}

export type ParseProgressCallback = (progress: ParseProgress) => void;

export interface PlaceParseResult {
  /** Detected source format. */
  fileType: RobloxFileType;

  /** The top-level instances (typically Services like Workspace, ReplicatedStorage) */
  rootInstances: RbxInstance[];

  /**
   * Non-fatal warnings accumulated during parsing.
   * Callers should surface these to the user.
   */
  warnings: string[];
}

// Internal tree node (used during XML/binary traversal and returned to UI)

export interface RbxInstance {
  referent: string;
  className: string;
  name: string;
  /** Assets attached to this instance's properties */
  assets: ParsedAssetRef[];
  children: RbxInstance[];
}
