---
---

const install = async () => {
	const cache = await caches.open('blog-{{ site.github.build_revision }}');
	const requests = [
		{% for page in site.pages %}
		{%- if page.url != '/sw.js' and page.url != '/feed.xml' and page.url != '/sitemap.xml' -%}
		'{{ page.url | remove: '.html' }}',
		{%- endif -%}
		{% endfor %}
		{% for post in site.posts %}
		'{{ post.url | remove: '.html' }}',
		{% endfor %}
		{% for file in site.static_files %}
		'{{ site.baseurl }}{{ file.path }}',
		{% endfor %}
	];
	const keys = await caches.keys();
	const remaingRequests = requests.filter(r => !keys.includes(r));
	await cache.addAll(remaingRequests);
}

const activate = async () => {
	const oldCaches = (await caches.keys()).filter((c) => c !== 'blog-{{ site.github.build_revision }}');
	for (const oldCache of oldCaches) {
		console.log(`Deleting old service worker: ${oldCache}`);
		await caches.delete(oldCache);
	}
}

const fetchCache = async (request) => {
	const cache = await caches.open('blog-{{ site.github.build_revision }}');
	if (request.method === 'GET') {
		let matchedResponse = await cache.match(request);
		if (matchedResponse) {
			return matchedResponse;
		}
		const withSlash = await cache.match(new Request(`${request.url}/`, {method: 'GET', headers: request.headers}));
		if (withSlash) {
			return withSlash;
		}
	}
	return await fetch(request);
}

self.addEventListener('install', (e) => {
	console.log('Installing service worker');
	e.waitUntil(install());
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	console.log(`Service worker has been activated`);
	e.waitUntil(activate());
});

self.addEventListener('fetch', (e) => {
	e.respondWith(fetchCache(e.request));
});
