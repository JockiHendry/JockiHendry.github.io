---
layout: post
category: Pemograman
title: Memakai Algolia Untuk Fitur Pencarian Di Jekyll
tags: [JavaScript, SearchEngine, Jekyll]
---

Salah satu fitur yang tidak saya jumpai setelah beralih dari Wordpress ke Jekyll adalah pencarian.  Cukup masuk akal karena Jekyll menghasilkan halaman HTML statis tanpa menggunakan fasilitas di sisi server seperti database.  Oleh sebab itu, bila ingin memiliki fitur pencarian, saya perlu menggunakan *search engine* terpisah yang akan meng-*index* setiap post di blog ini.  Biasanya saya akan men-install ElasticSearch yang men-ekspos fasilitas pencariannya dalam bentuk REST API 'siap saji' bagi klien.  Sebagai latihan, kali ini saya akan menggunakan Algolia yang merupakan layanan *hosted* tanpa perlu instalasi.  Salah satu nilai tambah Algolia adalah memiliki Search UI yang menyediakan widget siap pakai untuk ditempelkan ke website.  Karena ini adalah situs pribadi yang sederhana, saya mendaftar pada plan gratis Algolia yang memiliki batas 10.000 records dan 100.000 operasi pencarian per bulan.

Langkah pertama yang perlu saya lakukan adalah menentukan bagaimana cara meng-*upload* data artikel di situs ini ke Algolia agar bisa di-*index* dan dicari. Beberapa situs dokumentasi populer seperti situs dokumentasi Twitter Bootstrap yang juga dihasilkan oleh Jekyll menggunakan [DocSearch](https://community.algolia.com/docsearch/).  Ini adalah cara yang paling gampang karena DocSearch akan mengunjungi website dan melakukan *crawling* untuk mengambil informasi di website guna di-*index*.  Pemilik situs tidak perlu melakukan apa-apa.

Sebagai alternatifnya, saya juga bisa menggunakan plugin [jekyll-algolia](https://community.algolia.com/jekyll-algolia/).  Cara ini membutuhkan sebuah langkah ekstra dimana saya perlu memberikan perintah `bundle exec jekyll algolia` untuk meng-*upload* post Jekyll ke Algolia.  Sebagai contoh, saya bisa menambahkan `jekyll-algolia` pada file `Gemfile` seperti berikut ini:

```ruby
source 'https://rubygems.org'

group :jekyll_plugins do
	gem 'github-pages'
	gem 'jekyll-algolia'
end
```

Setelah itu, saya menambahkan baris berikut ini pada file konfigurasi Jekyll `_config.yml`:

```yaml
...
algolia:
  application_id: ubah_dengan_application_id_sesuai_akun_kamu
  api_key: ubah_dengan_search_only_api_key_sesuai_akun_kamu
  index_name: jekyll
...
```

Nilai `application_id` dan `api_key` (search-only API key) yang dipakai dapat dilihat melalui menu **API Keys** di dashboard Algolia.  Jangan lupa juga untuk mencatat nilai *Admin API Key*.  Nilai *Admin API Key* bersifat sensitif karena semua orang yang mengetahuinya bisa menambahkan record baru ke *index* saya.  Oleh sebab itu, saya tidak akan menyimpannya dalam kode program. Walaupun demikian, *Admin API Key* tetap dibutuhkan untuk meng-*upload* artikel yang dapat dilakukan melalui perintah berikut ini di terminal:


> <strong>$</strong> <code>ALGOLIA_API_KEY='nilai_admin_api_key' bundle exec jekyll algolia</code>


Setelah memberikan perintah di atas, bila saya membuka menu **Indices** di dashboard Algolia, saya akan menemukan sebuah index baru bernama `jekyll` yang berisi data artikel di situs ini, seperti yang terlihat pada gambar berikut ini:

![Isi Index Pada Dashboard Algolia]({{ "/assets/images/gambar_00001.png" | relative_url}}){:class="img-fluid rounded"}

Sekarang, data sudah tersimpan di Algolia.  Langkah berikutnya adalah menambahkan widget pencarian di HTML.  Ada beberapa pilihan yang disedian oleh Algolia, yang siap jadi meliputi [InstantSearch.js](https://community.algolia.com/instantsearchjs) dan [Autocomplete.js](https://github.com/algolia/autocomplete.js).  InstantSearch.js adalah pilihan yang tepat untuk halaman pencarian dimana tampilan hasil pencarian diatur oleh widget yang tersedia termasuk juga *pagination*, *filtering*, *refinement* dan sebagainya (untuk informasi lebih lengkap, lihat [daftar widget InstantSearch.js](https://community.algolia.com/instantsearch.js/v2/widgets.html).  Karena saya hanya menginginkan sebuah kotak pencarian dengan *auto complete* dimana men-klik hasil pencarian akan membuka artikel bersangkutan, maka saya akan menggunakan Autocomplete.js.

Saya segera menambahkan link ke CSS dan JavaScript Autocomplete.js ke dalam halaman HTML untuk situs ini.  Informasi lebih lanjut mengenai lokasi CDN Autocomplete.js dapat dibaca di halaman [Github Autocomplete.js](https://github.com/algolia/autocomplete.js).  Selain itu, perubahan yang saya lakukan dapat dibaca di [source code situs ini](https://github.com/JockiHendry/JockiHendry.github.io).

Untuk melakukan pencarian, saya akan meletakkan sebuah *text field* di pojok kanan atas *navbar*.  HTML-nya cukup sederhana seperti berikut ini:

```html
<nav class="navbar navbar-expand-lg navbar-dark bg-dark menu">
  <div class="container flex-column flex-sm-row align-items-start">
    ...
    <div id="search-input-container" class="flex-grow-0 align-self-stretch align-self-md-start">
      <input class="form-control mr-sm-2 ml-auto" type="search" id="search-input" placeholder="Cari" aria-label="Search">      
    </div>
  </div>
</nav>
```

Pada dasarnya, ini adalah sebuah *navbar* Bootstrap biasa.  Akan tetapi, saya melakukan sedikit modifikasi agar *text field* pencarian memenuhi layar begitu user men-klik *text field* tersebut (terinspirasi oleh pencarian di [Stackoverflow](https://stackoverflow.com)).  Kumpulan CSS Flexbox dari Bootstrap 4.1 sangat membantu untuk mencapai pergeseran secara *responsive* tanpa JavaScript.  Bila saya menyembunyikan daftar menu kategori dan menambahkan class `flex-grow-1` (baru di Bootstrap 4.1), maka *text field* akan mengisi bagian yang kosong hingga penuh.  Sebaliknya, setelah fokus keluar dari *text field*, saya cukup mengganti `flex-grow-1` menjadi `flex-grow-0`.  Sementara itu, class seperti `align-self-stretch align-self-md-start` menyebabkan *text field* memenuhi layar secara otomatis bila website dibuka di perangkat dengan layar kecil.

Berikutnya, saya menyiapkan scss untuk mengatur tampilan popup *auto-complete*.  Saya hanya men-*copy-paste* dari dokumentasi dan melakukan perubahan seadanya, kemudian menyimpannya di file `_algolia-autocomplete.scss` yang isinya seperti berikut ini:

```scss
.aa-dropdown-menu {

  width: 100%;
  background-color: #fff;
  border: 1px solid #999;
  border-top: none;
  box-shadow: 0 1rem 3rem rgba(0,0,0,.175)!important;

  .aa-suggestion {
    cursor: pointer;
    padding: 5px 6px;
    border-bottom: 1px solid #ccc;

    .result-title {

    }

    .result-snippet {
      color: #666;
      font-size: small;
    }

    &.aa-cursor {
      background-color: #B2D7FF;
    }

    em {
      font-weight: bold;
      font-style: normal;
    }
  }

  .aa-empty {
    padding: 5px 6px;
  }

  .branding {
    color: #999;
    font-size: 10px;
  }
  
}

.algolia-autocomplete {
  width: 100%;
  .aa-hint {
    color: #999;
  }
}

#search-input-container {    
  transition: all 600ms cubic-bezier(.165, .84, .44, 1);
  right: auto;
}
```

Sebagai langkah terakhir, saya menambahkan JavaScript untuk melakukan pencarian:

{% raw %}
```javascript
var client = algoliasearch('{{ site.algolia.application_id }}', '{{ site.algolia.api_key }}');
var index = client.initIndex('{{ site.algolia.index_name }}');
$('#search-input').autocomplete({ 
  hint: false,
  minLength: 3,              
  templates: {
    empty: '<div>Artikel tidak ditemukan</div>',
    footer: '<div class="branding text-center">Powered by <img src="https://www.algolia.com/static_assets/images/press/downloads/algolia-logo-light.svg" height="15px"/></div>'
  }
}, [{
  source: $.fn.autocomplete.sources.hits(index, { hitsPerPage: 5}),
  displayKey: 'title',      
  templates: {
    suggestion: function(suggestion) {
      return '<div class="result-title">' + suggestion._highlightResult.title.value + '</div><div class="result-snippet">' + suggestion._snippetResult.content.value + '</div>';
    }
  },
  debounce: 500,
}]).on('autocomplete:selected', function(event, suggestion, dataset) {
  window.location.href = suggestion.url;      
});
```
{% endraw %}

Pada kode program di atas, saya membatasi pencarian agar dimulai setelah minimal 3 karakter (`minLength`) dan setidaknya setelah 500 ms sejak pencarian terakhir (`debounce`).  Pada `source` pencarian, nilai `templates.suggestion` mengembalikan HTML yang mengandung judul artikel dan isi artikel yang mengandung kata kunci yang dicari.  Bagian yang mengandung kata kunci yang dicari juga secara otomatis sudah ditandai dalam tag `<em>`.  Autocomplete.js akan menghasil *custom event* `autocomplete:selected` bila hasil pencarian dipilih oleh pengguna.  Pada kode program di atas, saya melakukan navigasi ke lokasi URL untuk artikel yang dipilih oleh pengguna.	

Hasil akhirnya dapat dilihat pada blog ini.  *Text field* pencarian tersebut berada di pojok kanan atas layar.