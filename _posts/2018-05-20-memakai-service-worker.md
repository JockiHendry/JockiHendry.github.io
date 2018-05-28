---
layout: post
category: Pemograman
title: Memakai Service Worker Agar Website Berfungsi Saat Offline
tags: [JavaScript, PWA, Jekyll]
---

Walaupun situs ini adalah sebuah situs statis, saat mencobanya secara offline, saya menemukan sebuah masalah.  Setelah cache kadaluarsa, browser berusaha menarik file dari CDN seperti Bootstrap, Highcharts dan sebagainya.  Alangkah baiknya bila saya menyimpan file yang dibutuhkan secara permanen untuk dipakai secara offline.  Salah satu solusinya adalah dengan menggunakan Service Worker API yang biasanya identik dengan Progressive Web Apps.

Langkah pertama yang saya lakukan adalah mendefinisikan kode program service worker dalam file `sw.js` yang berada di root project.  Saya tidak meletakkannya pada folder `assets` karena secara default, scope dari service worker ditentukan oleh direktori dimana file service worker tersebut berada; saya perlu mengendalikan seluruh URL lain dalam website ini.  Isi file `sw.js` saya terlihat seperti berikut ini:

{% raw %}
```javascript
---
---
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open('blog').then(function(cache) {
    return cache.addAll([
      {% for page in site.pages %}
      '{{ page.url | remove: '.html' }}',
      {% endfor %}
      {% for post in site.posts %}
      '{{ post.url | remove: '.html' }}',
      {% endfor %}
      {% for file in site.static_files %}
      '{{ site.baseurl }}{{ file.path }}',
      {% endfor %}                
      'https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css',
      'https://code.jquery.com/jquery-3.3.1.slim.min.js',
      'https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js',
      'https://cdn.jsdelivr.net/algoliasearch/3/algoliasearch.min.js',
      'https://cdn.jsdelivr.net/autocomplete.js/0.30.0/autocomplete.jquery.min.js',
      'https://code.highcharts.com/highcharts.js',      
    ]);
  }));
});

self.addEventListener('fetch', function(e) {
  e.respondWith(caches.match(e.request).then(function(response) { 
    return response;
  }));
});
```
{% endraw %}

Saya perlu menambahkan dua baris `---` yang disebut sebagai *Front Matter* di Jekyll.  Ini adalah sebuah penanda bagi Jekyll bahwa file ini perlu diikutsertakan pada website yang dihasilkan.

Isi dari `sw.js` pada dasarnya adalah event listener.  Event `install` adalah tahap paling awal dari siklus hidup sebuah service worker.  Event ini akan dikerjakan pada saat service worker didaftarkan.  Pada kode program di atas, saya memanggil Cache API untuk menyimpan file statis yang dihasilkan oleh Jekyll.  Selain file statis yang dihasilkan Jekyll, saya juga men-*cache* file eksternal yang saya ambil dari CDN.

Untuk mendaftarkan service worker, saya menambahkan kode program ini pada file HTML saya:

```javascript
// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {                
      console.log('Service worker registered for the following scope: ', registration.scope);
    }, function(err) {
      console.error('Fail to register service worker', err);
    });
  });
}
```

Bila ini adalah situs Single Page Application (SPA) seperti Angular, saya hanya perlu meletakkan kode program ini pada file yang di-download pertama kali.  Sebagai contoh, pada proyek Angular 6, saya akan meletakkan kode ini di `main.ts`. Sejujurnya, Angular 5 ke atas sudah dilengkapi dengan implementasi service worker sehingga saya hanya perlu menambahkan `@angular/pwa` pada dependency proyek.  Lalu bagaimana dengan Jekyll dimana setiap file HTML adalah request yang berbeda?  Saya tetap bisa dengan aman memanggil `serviceWorker.register()` di setiap file yang ada.  Hal ini karena bila service worker sudah terdaftar sebelumnya, `serviceWorker.register()` tidak akan melakukan apa-apa.  Oleh sebab itu, saya meletakkan kode program JavaScript di atas pada file `footer.html`.

Setelah event `install` dan `active` terwujud, setiap kali website memanggil sebuah resource dari jaringan, ia akan menghubungi service worker terlebih dahulu (tidak langsung terhubung ke Internet!).  Dengan demikian, service worker memiliki fungsi mirip seperti sebuah proxy transparan.  Saya bisa men-'nyadap' komunikasi ke Internet melalui event `fetch`.  Disini, saya bisa bisa menentukan untuk mengembalikan hasil dari Cache API atau meneruskan request ke Internet.  Pada kode program service worker di atas, saya akan selalu mengembalikan respon dari *cache* dan tidak pernah melakukan koneksi internet lagi setelah service worker aktif!

Untuk memastikan service worker berhasil didaftarkan dengan baik, saya bisa membuka developer tools di Chrome dan memilih tab **Application**, **Service Workers**:

![Daftar service worker di Chrome developer tools]({{ "/assets/images/gambar_00002.png" | relative_url}}){:class="img-fluid rounded"}

Sekarang, bila saya mematikan server `jekyll serve` atau menandai checkbox *Offline* di Chrome developer tools, halaman website tetap bisa diakses seperti biasa.  Bila saya membuka tab **Network**, saya akan menemukan informasi *from ServiceWorker* untuk resource yang diambil dari *cache*, seperti yang terlihat pada gambar berikut ini:

![Resource yang diambil melalui service worker]({{ "/assets/images/gambar_00003.png" | relative_url}}){:class="img-fluid rounded"}

Ini menunjukkan service worker saya sudah bekerja.  Apakah sudah selesai?  Tunggu!  Perhatikan kembali kode program untuk event `fetch`:  saya selalu mengembalikan hasil dari *cache*!  Bagaimana bila ada perubahan di sisi server?  Bagaimana bila ada artikel baru?  Setiap kali ada perubahan pada file `sw.js`, biarpun hanya satu byte, browser akan men-install service worker kembali.  Dengan demikian, saya bisa menggunakan sesuatu yang unik yang berbeda setiap kali situs diperbaharui.  Sebagai latihan, saya akan menggunakan nilai `site.github.build_revision` yang disediakan oleh GitHub Pages.  Ini adalah nomor pengenal *commit* terakhir yang menyebabkan situs di Github Pages diperbaharui.  Karena setiap *commit* di Git masing-masing memiliki nomor pengenal yang unik, saya bisa menggunakannya secara aman.

Saya akan mulai dengan mengubah `sw.js` menjadi seperti berikut ini:

{% raw %}
```javascript
---
---

self.addEventListener('install', function(e) {  
  e.waitUntil(caches.open('blog-{{ site.github.build_revision }}').then(function(cache) {
    return cache.addAll([
      {% for page in site.pages %}
      {%- if page.url != '/sw.js' -%} 
      '{{ page.url | remove: '.html' }}',
      {%- endif -%}
      {% endfor %}
      {% for post in site.posts %}      
      '{{ post.url }}',     
      {% endfor %}
      {% for file in site.static_files %}       
      '{{ site.baseurl }}{{ file.path }}',    
      {% endfor %}                
      'https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css',
      'https://code.jquery.com/jquery-3.3.1.slim.min.js',
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
```
{% endraw %}

Pada kode program di atas, saya mengubah event listener `fetch` agar bukan hanya mengembalikan respone dari *cache*.  Bila ada request belum di-*cache*, ia akan melakukan request ke Internet.  Selain itu, saya juga menambahkan event listener `activate`.  Pada saat service worker baru (akibat perubahan isi `sw.js`) diaktifkan, event listener `activate` akan dikerjakan.  Yang saya lakukan disini adalah menghapus *cache* yang lama.  Karena sekarang setiap versi memakai nama *cache* yang unik, saya hanya perlu menghapus semua *cache* yang namanya tidak sesuai dengan versi sekarang ini (terbaru).

Untuk melihat daftar *cache* dan apa saja yang tersimpan di masing-masing *cache*, saya bisa membuka tab **Application**, **Cache Storage** di Chrome developer tools, seperti yang terlihat pada gambar berikut ini:

![Daftar cache di Chrome developer tools]({{ "/assets/images/gambar_00004.png" | relative_url}}){:class="img-fluid rounded"}

Sekarang, setiap kali saya men-*build* website dengan *commit* terbaru dan pengguna men-*refresh* browser, *cache* lama di browser pengguna akan dihapus dan digantikan dengan yang baru.