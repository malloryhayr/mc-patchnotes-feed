import { Feed } from '@peertube/feed';
import sizeOf from 'image-size';

export interface Env {}

enum VersionType {
	SNAPSHOT = 'snapshot',
	RELEASE = 'release',
}

interface RawPatchnotes {
	version: number;
	entries: RawPatchnotesEntry[];
}

interface RawPatchnotesEntry {
	title: string;
	version: string;
	type: VersionType;
	image: {
		title: string;
		url: string;
	};
	contentPath: string;
	id: string;
}

interface PatchnotesEntry {
	title: string;
	time: string;
	version: string;
	type: VersionType;
	image: {
		title: string;
		url: string;
	};
	body: string;
	id: string;
}

interface PistonMeta {
	latest: {
		release: string;
		snapshot: string;
	};
	versions: PistonMetaVersion[];
}

interface PistonMetaVersion {
	id: string;
	type: string;
	url: string;
	time: string;
	releaseTime: string;
	sha1: string;
	complianceLevel: number;
}

interface LauncherContentEntry {
	title: string;
	version: string;
	type: string;
	image: {
		title: string;
		url: string;
	};
	body: string;
	id: string;
}

const META_BASE_URL = 'https://piston-meta.mojang.com';
const LAUNCHER_BASE_URL = 'https://launchercontent.mojang.com';

let pistonMeta: PistonMeta;

async function fetchPistonMeta() {
	if (pistonMeta == null) pistonMeta = await (await fetch(META_BASE_URL + '/mc/game/version_manifest_v2.json')).json();
}

async function getPatchnotes(raw: RawPatchnotesEntry): Promise<PatchnotesEntry> {
	await fetchPistonMeta();
	const meta: PistonMetaVersion = pistonMeta.versions.find((x) => x.id == raw.version) || {
		id: '',
		type: '',
		url: '',
		time: '',
		releaseTime: '',
		sha1: '',
		complianceLevel: -1,
	};
	const content: LauncherContentEntry = await (await fetch(LAUNCHER_BASE_URL + '/v2/' + raw.contentPath)).json();

	return {
		title: content.title,
		time: meta.time,
		version: meta.id,
		type: raw.type,
		image: {
			title: content.image.title,
			url: LAUNCHER_BASE_URL + content.image.url,
		},
		body: content.body,
		id: raw.id,
	};
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const feed = new Feed({
			title: 'Minecraft Patch Notes',
			description: 'Patch notes for Minecraft: Java Edition',
			id: 'https://' + new URL(request.url).host + '/',
			link: 'https://www.minecraft.net/en-us/articles',
			language: 'en',
			favicon: 'https://www.minecraft.net/etc.clientlibs/minecraft/clientlibs/main/resources/favicon.ico',
			copyright: `All rights reserved 2009-${new Date().getFullYear()}, Mojang`,
		});

		let rawPatchnotes: RawPatchnotes = await (await fetch(LAUNCHER_BASE_URL + '/v2/javaPatchNotes.json')).json();
		for (const entry of rawPatchnotes.entries.slice(0, 5)) {
			const patchnotes = await getPatchnotes(entry);
			const url = `https://quiltmc.org/en/mc-patchnotes/#${patchnotes.version}`;
			const image = `<img src="${patchnotes.image.url}" alt="${patchnotes.title}">`;
			feed.addItem({
				title: patchnotes.title,
				id: patchnotes.id,
				link: url,
				content: image + patchnotes.body,
				date: new Date(patchnotes.time),
			});
		}
		switch (new URL(request.url).pathname) {
			case '/json': {
				return new Response(feed.json1(), {
					headers: {
						'content-type': 'application/json',
					},
				});
			}
			default: {
				return new Response(feed.rss2(), {
					headers: {
						'content-type': 'application/rss+xml',
					},
				});
			}
		}
	},
};
