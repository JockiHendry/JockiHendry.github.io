---
layout: post
category: Pemograman
title: Menjalankan Kode Program Native Di Node.js
tags: [Node]
---

Ada kalanya modul bawaan Node.js tidak cukup dan programmer perlu mengakses fitur *native* di sistem operasi.  Untuk itu, Node.js memiliki fasilitas
memanggil kode program *native* yang ditulis dalam bahasa C/C++.  Untuk mengetahui *package* yang menggunakan kode program *native*, saya dapat mencari
file berakhiran `*.node` di `node_modules`.  Sebagai contoh, *package* `fsevents` yang popular berisi kode program *native* dalam C untuk memberikan
notifikasi bila file di folder tertentu berubah di sistem operasi Mac.  Pada artikel ini, saya akan mencoba memanggil kode program *native* C yang 
menggunakan Xlib untuk menampilkan sebuah *window* di dekstop Linux.

Salah satu tool yang sangat membantu dalam proses kompilasi kode program C/C++ di aplikasi Node.js adalah `node-gyp`.  Karena akan sering menggunakannya di 
berbagai proyek yang berbeda, saya dapat meng-install `node-gyp` secara global dengan menggunakan perintah `npm install -g node-gyp`.  Pada sistem operasi
Ubuntu yang saya pakai, semua yang dibutuhkan oleh `node-gyp` seperti Python, `make` dan `GCC` sudah tersedia.

Berikutnya, saya akan membuat sebuah kode program C bernama `jendela.c` yang akan menggunakan Xlib untuk menampilkan sebuah *window* di desktop Linux.  Isi
kode program untuk `jendela.c` terlihat seperti berikut ini:

```c
#include <assert.h>
#include <node_api.h>
#include <X11/Xlib.h>

static void Tampilkan(napi_env env, napi_callback_info info) {
    // Kode program yang menggunakan Node-API (NAPI) untuk membaca argumen dari JS dan sebagainya.
    napi_status status;
    size_t argc = 1;
    napi_value argv[1];
    status = napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
    if (status != napi_ok) return;

    char pesan[100];
    status = napi_get_value_string_utf8(env, argv[0], pesan, 100, NULL);
    if (status != napi_ok) return;

    // Kode program yang menggunakan Xlib untuk membuat jendela.
    Display *d;
    Window w;
    XEvent e;
    int s;
    d = XOpenDisplay(NULL);
    s = DefaultScreen(d);
    w = XCreateSimpleWindow(d, RootWindow(d, s), 10, 10, 800, 200, 1, BlackPixel(d, s), WhitePixel(d, s));
    XSelectInput(d, w, ExposureMask);
    XMapWindow(d, w);
    while (1) {
        XNextEvent(d, &e);
        if (e.type == Expose) {
            XDrawString(d, w, DefaultGC(d, s), 400, 100, pesan, strlen(pesan));
        }
    }
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_property_descriptor desc = {
        "tampilkan", NULL, Tampilkan, NULL, NULL, NULL, napi_default, NULL
    };
    status = napi_define_properties(env, exports, 1, &desc);
    if (status != napi_ok) return NULL;
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init);
```

Pada kode program C di atas, saya menggunakan Node-API yang menyediakan abstraksi untuk dalam berinteraksi dengan JavaScript (runtime V8). 
Salah satu tujuan dari Node-API adalah untuk menghindari perubahan di kode program C setiap kali terjadi perubahan Node.js (saat versi baru dirilis).  Sebagai contoh,
pada kode program di atas, saya menggunakan `napi_value` untuk mewakili nilai di JavaScript, menggunakan `napi_get_value_string_utf8` untuk mengubah string yang
dikirim dari JavaScript menjadi `char*` (*string* di C) yang dapat dipakai di kode program C. Untuk informasi lebih lanjut mengenai apa saja yang disediakan oleh Node-API, saya dapat membaca dokumentasi Node.js di bagian [C/C++ addons with Node-API](https://nodejs.org/api/n-api.html).

Bagian yang paling pertama kali dikerjakan di kode program C di atas adalah `NAPI_MODULE` yang mendaftarkan *module* dengan me-referensi-kan *function* `Init`. Ini
menyebabkan *function* `Init` akan dikerjakan saat kode program JavaScript melakukan `require()` *module* ini.  Pada *function* `Init`, saya mendaftarkan sebuah method yang dapat dipanggil di JavaScript dengan nama `tampilkan()`.  Bila method ini dipanggil di JavaScript, maka *function* `Tampilkan` di C akan dikerjakan. Kode program 
*function* `Tampilkan` akan membaca sebuah argumen *string* dari JavaScript dan menuliskannya ke layar melalui *function* `XDrawString` dari Xlib.

<div class="alert alert-warning" role="alert">
Bila library Xlib masih belum tersedia, gunakan perintah seperti <code>sudo apt install libx11-dev</code> untuk melakukan instalasinya.  Kebanyakan distro modern
Linux menggunakan Xlib sebagai GUI.  Walaupun demikian, Xlib biasanya tidak dipakai secara langsung, melainkan melalui <em>toolkit</em> yang lebih <em>user-friendly</em>
seperti Qt dan GTK.  Pada artikel ini, karena hanya sebuah latihan, saya menggunakan Xlib secara langsung agar tidak perlu melakukan instalasi <em>toolkit</em> lagi.
</div>

Sebagai langkah berikutnya, saya akan membuat sebuah file baru dengan nama `binding.gyp` dengan isi seperti berikut ini:

```json
{
  "targets": [
    {
      "target_name": "jendela",
      "sources": ["jendela.c"],
      "link_settings": {
        "libraries": [
          "-lX11"
        ]
      }
    }
  ]
}
```

Ini adalah file konfigurasi yang dibutuhkan oleh `node-gyp`.  Saya menunjukkan lokasi file C saya di `sources` dan juga nama *output* yang dihasilkan di `target_name`.  Karena kode program C saya tergantung pada library Xlib, saya menambahkan `-lX11` pada `link_settings.libraries` sama seperti saat saya melakukan kompilasi manual (yang biasanya diberikan ke *linker* seperti `ld`).  Setelah ini, saya bisa menjalankan perintah:

> <strong>$</strong> <code>node-gyp configure</code>

```
gyp info it worked if it ends with ok
gyp info using node-gyp@8.4.0
gyp info using node@14.18.1 | linux | x64
gyp info find Python using Python version 3.8.10 found at "python3"
gyp info spawn python3
...
gyp info ok 
```

Perintah ini akan menghasilkan `Makefile` di folder *build* secara otomatis.  Saya hanya tinggal melakukan *building* saya dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>node-gyp build</code>

```
gyp info it worked if it ends with ok
gyp info using node-gyp@8.4.0
gyp info using node@14.18.1 | linux | x64
gyp info spawn make
gyp info spawn args [ 'BUILDTYPE=Release', '-C', 'build' ]
make: Entering directory 'latihan/build'
  CC(target) Release/obj.target/jendela/jendela.o
  SOLINK_MODULE(target) Release/obj.target/jendela.node
  COPY Release/jendela.node
make: Leaving directory 'latihan/build'
gyp info ok 
```

Hasil akhir dari proses ini adalah sebuah file dengan nama `jendela.node` di folder `build/Release`.  Ini adalah kode program *native* yang bisa langsung saya
pakai di kode program JavaScript.  Sebagai contoh, saya membuat file `latihan.js` dengan isi seperti berikut ini:

```javascript
const jendela = require('./build/Release/jendela');
jendela.tampilkan('Jocki Jocki Jocki');
```

Bila saya menjalankan kode program ini dengan:

> <strong>$</strong> <code>node latihan.js</code>

Saya akan mendapatkan hasil seperti berikut ini:

![Menampilkan Jendela Melalui Kode Native C Di Node.js]({{ "/assets/images/gambar_00053.png" | relative_url}}){:class="img-fluid rounded"}

Selain mendemonstrasikan bagaimana Node.js dapat di-*extend* secara mudah melalui kode program *native* C/C++, hasil akhir di atas juga menunjukkan
bahwa Node.js juga dapat menampilkan GUI *native* di sistem operasi yang menjalankannya.