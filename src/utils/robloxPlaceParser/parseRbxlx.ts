import { buildAssetRef, classifyProperty, extractAssetId } from './assetClassifier';
import { createProgressReporter, yieldToUI } from './asyncUtils';
import type { ParseProgressCallback, PlaceParseResult, RbxInstance } from './types';

// Fast byte scanner for .rbxlx XML files.
// Avoids V8 string length limits by parsing directly from the Uint8Array.
export async function parseRbxlx(
  bytesOrText: Uint8Array | string,
  fileName: string,
  onProgress?: ParseProgressCallback,
): Promise<PlaceParseResult> {
  const warnings: string[] = [];
  const rootInstances: RbxInstance[] = [];
  const reportProgress = createProgressReporter(onProgress);

  let xmlBytes: Uint8Array;
  if (typeof bytesOrText === 'string') {
    xmlBytes = new TextEncoder().encode(bytesOrText);
  } else {
    xmlBytes = bytesOrText;
  }

  const totalLength = xmlBytes.length;
  reportProgress('Scanning XML structure', 0, totalLength);

  // Helper to decode a small slice as a string
  const textDecoder = new TextDecoder('utf-8');
  function decodeSlice(start: number, end: number): string {
    return textDecoder.decode(xmlBytes.subarray(start, end));
  }

  // Byte sequences for fast searching
  const TAG_ITEM_OPEN = new TextEncoder().encode('<Item');
  const TAG_ITEM_CLOSE = new TextEncoder().encode('</Item>');
  const TAG_PROPERTIES_OPEN = new TextEncoder().encode('<Properties>');
  const TAG_PROPERTIES_CLOSE = new TextEncoder().encode('</Properties>');
  const TAG_STRING_OPEN = new TextEncoder().encode('<string');
  const TAG_CONTENT_OPEN = new TextEncoder().encode('<Content');
  const TAG_SHAREDSTRING_OPEN = new TextEncoder().encode('<SharedString');

  let pos = 0;

  // Custom simple indexOf for Uint8Array
  function findNext(sequence: Uint8Array, startPos: number): number {
    const firstByte = sequence[0];
    const seqLen = sequence.length;
    for (let i = startPos; i <= xmlBytes.length - seqLen; i++) {
      if (xmlBytes[i] === firstByte) {
        let match = true;
        for (let j = 1; j < seqLen; j++) {
          if (xmlBytes[i + j] !== sequence[j]) {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
    }
    return -1;
  }

  const sharedStringDict = new Map<string, string>();

  interface UnresolvedAsset {
    instance: RbxInstance;
    propName: string;
    hash: string;
  }
  const unresolvedAssets: UnresolvedAsset[] = [];

  const pathStack: RbxInstance[] = [];
  let inProperties = false;
  let iterations = 0;

  // We loop to find the next tag of interest instead of full parsing
  while (pos < totalLength) {
    if (iterations++ % 5000 === 0) {
      reportProgress('Scanning XML structure', pos, totalLength);
      await yieldToUI();
    }

    // Find the next '<'
    const openAngle = xmlBytes.indexOf(0x3c /* < */, pos);
    if (openAngle === -1) break;
    pos = openAngle + 1;

    // What tag is this?
    // Quick check using slice
    const tagPrefix = decodeSlice(openAngle, Math.min(openAngle + 15, totalLength));

    if (tagPrefix.startsWith('</Item>')) {
      pathStack.pop();
      pos = openAngle + 7;
    } else if (tagPrefix.startsWith('</Properties>')) {
      inProperties = false;
      pos = openAngle + 13;
    } else if (tagPrefix.startsWith('<Item')) {
      // Find end of tag
      const closeAngle = xmlBytes.indexOf(0x3e /* > */, openAngle);
      if (closeAngle === -1) break;

      const tagStr = decodeSlice(openAngle, closeAngle + 1);
      const classMatch = tagStr.match(/class="([^"]+)"/);
      const referentMatch = tagStr.match(/referent="([^"]+)"/);

      const className = classMatch ? classMatch[1] : 'Unknown';
      const referent = referentMatch ? referentMatch[1] : `Item_${pos}`;

      const newInstance: RbxInstance = {
        referent,
        className,
        name: className,
        assets: [],
        children: [],
      };

      if (pathStack.length > 0) {
        pathStack[pathStack.length - 1].children.push(newInstance);
      } else {
        rootInstances.push(newInstance);
      }

      // Check if self-closing
      if (tagStr.endsWith('/>')) {
        // Do not push to stack
      } else {
        pathStack.push(newInstance);
      }
      pos = closeAngle + 1;
    } else if (tagPrefix.startsWith('<Properties>')) {
      inProperties = true;
      pos = openAngle + 12;
    } else if (
      inProperties &&
      (tagPrefix.startsWith('<string') ||
        tagPrefix.startsWith('<Content') ||
        tagPrefix.startsWith('<SharedString'))
    ) {
      const closeAngle = xmlBytes.indexOf(0x3e /* > */, openAngle);
      if (closeAngle === -1) break;

      const tagStr = decodeSlice(openAngle, closeAngle + 1);
      const nameMatch = tagStr.match(/name="([^"]+)"/);
      const propName = nameMatch ? nameMatch[1] : null;

      const isSelfClosing = tagStr.endsWith('/>');

      let textContent = '';
      let endPos = closeAngle + 1;

      if (!isSelfClosing) {
        const nextLess = xmlBytes.indexOf(0x3c /* < */, closeAngle + 1);
        if (nextLess !== -1) {
          textContent = decodeSlice(closeAngle + 1, nextLess).trim();
          endPos = nextLess;
        }
      }

      if (tagPrefix.startsWith('<Content') && !isSelfClosing) {
        // It's probably nested with <url>
        // Let's just find the closing </Content>
        const contentEnd = xmlBytes.indexOf(0x3c /* < */, openAngle + 1);
        const actualEnd = findNext(new TextEncoder().encode('</Content>'), openAngle);
        if (actualEnd !== -1) {
          const innerStr = decodeSlice(closeAngle + 1, actualEnd);
          const urlMatch = innerStr.match(/<url>([^<]+)<\/url>/);
          if (urlMatch) textContent = urlMatch[1].trim();
          endPos = actualEnd + 10;
        }
      }

      if (textContent.startsWith('<![CDATA[')) {
        textContent = textContent.substring(9, textContent.length - 3);
      }

      const currentItem = pathStack[pathStack.length - 1];
      if (currentItem && propName && textContent) {
        if (tagPrefix.startsWith('<SharedString')) {
          unresolvedAssets.push({
            instance: currentItem,
            propName,
            hash: textContent,
          });
        } else {
          if (propName === 'Name') {
            currentItem.name = textContent;
          } else {
            const assetType = classifyProperty(currentItem.className, propName);
            if (assetType) {
              const assetId = extractAssetId(textContent);
              if (assetId) {
                currentItem.assets.push(
                  buildAssetRef(
                    currentItem.className,
                    currentItem.name,
                    propName,
                    textContent,
                    assetId,
                    '', // Set below
                    assetType,
                  ),
                );
              } else if (textContent !== 'nil' && textContent !== '0') {
                warnings.push(
                  `[rbxlx] Could not extract asset ID from ${currentItem.className}.${propName} - raw value: "${textContent}"`,
                );
              }
            }
          }
        }
      }
      pos = endPos;
    } else if (!inProperties && tagPrefix.startsWith('<SharedString')) {
      const closeAngle = xmlBytes.indexOf(0x3e /* > */, openAngle);
      if (closeAngle === -1) break;
      const tagStr = decodeSlice(openAngle, closeAngle + 1);
      const md5Match = tagStr.match(/md5="([^"]+)"/);

      const nextLess = xmlBytes.indexOf(0x3c /* < */, closeAngle + 1);
      if (md5Match && nextLess !== -1) {
        const textContent = decodeSlice(closeAngle + 1, nextLess).trim();
        try {
          sharedStringDict.set(md5Match[1], atob(textContent));
        } catch (e) {
          sharedStringDict.set(md5Match[1], textContent);
        }
        pos = nextLess;
      } else {
        pos = closeAngle + 1;
      }
    } else {
      // Just advance past this tag to avoid getting stuck
      const closeAngle = xmlBytes.indexOf(0x3e /* > */, openAngle);
      if (closeAngle === -1) break;
      pos = closeAngle + 1;
    }
  }

  // Resolve SharedStrings
  for (const ref of unresolvedAssets) {
    const rawValue = sharedStringDict.get(ref.hash);
    if (!rawValue) continue;

    const assetType = classifyProperty(ref.instance.className, ref.propName);
    if (assetType) {
      const assetId = extractAssetId(rawValue);
      if (assetId) {
        ref.instance.assets.push(
          buildAssetRef(
            ref.instance.className,
            ref.instance.name,
            ref.propName,
            rawValue,
            assetId,
            '',
            assetType,
          ),
        );
      }
    }
  }

  // Build hierarchy paths
  function buildPaths(node: RbxInstance, currentPath: string) {
    const nextPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    for (const asset of node.assets) {
      asset.instanceName = node.name;
      asset.path = nextPath;
    }
    for (const child of node.children) {
      buildPaths(child, nextPath);
    }
  }

  for (const root of rootInstances) {
    buildPaths(root, '');
  }

  reportProgress('Scanning XML structure', totalLength, totalLength, true);

  return { fileType: 'rbxlx', rootInstances, warnings };
}
