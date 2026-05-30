#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// read source
const luaSource = readFileSync(join(root, 'src-tauri', 'plugin', 'plugin.lua'), 'utf8');

// Escape any ]]> sequences that would break the CDATA block
const safeSource = luaSource.replace(/]]>/g, ']]]]><![CDATA[>');

// build .rbxmx
const referent = 'RBXE00000000000000000000000000000001';

const rbxmx = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
	<External>null</External>
	<External>nil</External>
	<Item class="Script" referent="${referent}">
		<Properties>
			<string name="Name">ISpooferMotion</string>
			<ProtectedString name="Source"><![CDATA[${safeSource}]]></ProtectedString>
			<bool name="Disabled">false</bool>
		</Properties>
	</Item>
</roblox>
`;

// write output
const outDir = join(root, 'dist-plugin');
mkdirSync(outDir, { recursive: true });

const outPath = join(outDir, 'ISpooferMotion.rbxmx');
writeFileSync(outPath, rbxmx, 'utf8');

const kb = (luaSource.length / 1024).toFixed(1);
console.log(`    Plugin built successfully`);
console.log(`    Source : src-tauri/plugin/plugin.lua  (${kb} KB)`);
console.log(`    Output : dist-plugin/ISpooferMotion.rbxmx`);
console.log(``);
