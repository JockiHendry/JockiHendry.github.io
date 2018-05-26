---
---

self.addEventListener('install', function(e) {	
	self.skipWaiting();
	e.waitUntil(caches.open('blog-{{ site.github.build_revision }}').then(function(cache) {
		return cache.addAll([
			{% for page in site.pages %}
			{%- if page.url != '/sw.js' -%} 
			'{{ page.url | remove: '.html' }}',
			{%- endif -%}
			{% endfor %}
			{% for post in site.posts %}			
			'{{ post.url | remove: '.html' }}',			
			{% endfor %}
			{% for file in site.static_files %}				
			'{{ site.baseurl }}{{ file.path }}',		
			{% endfor %}								
			'https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css',
			'https://code.jquery.com/jquery-3.3.1.min.js',
			'https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js',
			'https://cdn.jsdelivr.net/algoliasearch/3/algoliasearch.min.js',
			'https://cdn.jsdelivr.net/autocomplete.js/0.30.0/autocomplete.jquery.min.js',
			'https://code.highcharts.com/highcharts.js',			
		]);
	}));
});

self.addEventListener('activate', function(e) {
	e.waitUntil(caches.keys().then(function(cacheNames) {
		return Promise.all(
			cacheNames.map(function(cacheName) {
				if (cacheName != 'blog-{{ site.github.build_revision }}') {
					return caches.delete(cacheName);
				}
			})
		);
	}));
});

self.addEventListener('fetch', function(e) {
	e.respondWith(caches.match(e.request).then(function(response) {		
		return response || fetch(e.request);
	}));
});
