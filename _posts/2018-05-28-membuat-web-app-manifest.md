---
layout: post
category: Pemograman
title: Membuat Web App Manifest
tags: [JavaScript, PWA]
---

Salah satu ciri website PWA adalah sudah dilengkapi dengan [web app manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest).  Setelah memiliki *web app manifest*, pengguna bisa men-*install* website di Android tanpa harus melalui Google Play Store.  Web site tetap bisa bekerja bila dijalankan dari *shortcut* hasil instalasi karena sudah menggunakan *service worker*.  Untuk merasakan pengalaman *install* website, saya akan menambahkan *web app manifest* pada situs blog ini.

Saya akan mulai dengan membuat file manifest bernama *manifest.webmanifest* di *root directory* proyek dengan isi seperti berikut ini:

```json
{
  "name": "Blog Jocki",
  "short_name": "BlogJocki",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#fff",
  "theme_color": "#fff",
  "description": "Aplikasi Blog Jocki",
  "lang": "id",
  "icons": [{
    "src": "assets/images/icon-192.png",
    "sizes": "192x192",
    "type": "image/png"
  }, {
    "src": "assets/images/icon-512.png",
    "sizes": "512x512",
    "type": "image/png"
  }]  
}
```

Untuk memakai manifest ini, saya perlu mendeklarasikannya di bagian `<head>` dengan kode HTML seperti berikut ini:

```html
<link rel="manifest" href="/manifest.webmanifest">
```

Setelah itu, saya membuat link dimana pengguna bisa men-klik-nya guna men-*install* blog ini.  Kemudian, saya menambahkan JavaScript berikut:

```javascript
let deferredPrompt;                
window.addEventListener('beforeinstallprompt', (e) => {          
  $("#menu-install").removeClass('d-none');
  e.preventDefault();
  deferredPrompt = e;          
});

$("#btn-install").click((e) => {
  e.preventDefault();
  $("#menu-install").hide();
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((result) => {
    deferredPrompt = null;
  });
});
```

Saat saya menampilkan situs ini di browser, link *Install* tidak muncul!  Hal ini karena salah satu syarat agar PWA bekerja adalah protokol yang digunakan wajib berupa HTTPS. Karena sedang menjalankan situs di komputer lokal untuk keperluan development, khusus untuk *localhost*, saya bisa membuka Developer Tools di Chrome, kemudian men-klik menu **Application**, **Manifest**.  Setelah itu, saya men-klik **Add to homescreen** di pengaturan tersebut.  Kini, link untuk instalasi akan muncul di bagian *footer* website.  Bila saya men-klik link tersebut, akan muncul sebuah notifikasi konfirmasi yang terlihat seperti pada gambar berikut ini:

![Notifikasi instalasi aplikasi]({{ "/assets/images/gambar_00008.png" | relative_url}}){:class="img-fluid rounded"}

Bila men-klik **Add**, akan ada sebuah *shortcut* aplikasi baru untuk blog saya di sistem operasi:

![Shortcut untuk situs]({{ "/assets/images/gambar_00009.png" | relative_url}}){:class="img-fluid rounded"}

Bila saya membuka *shortcut* tersebut, akan muncul situs ini dalam bentuk sebuah window terpisah yang minimalis (tidak terlihat seperti browser).  Tampilannya akan terlihat seperti pada gambar berikut ini:

![Tampilan aplikasi]({{ "/assets/images/gambar_00010.png" | relative_url}}){:class="img-fluid rounded"}

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Untuk menghapus aplikasi ini, buka <chrome://apps/> dan klik kanan pada icon aplikasi, kemudian pilih <strong>Remove from Chrome...</strong>.
</div>

Lalu, bagaimana dengan instalasi di perangkat Android?  Untuk merasakan pengalamannya seperti apa, saya perlu menjalankan sebuah emulator Android.  Namun sekarang saya menjumpai sebuah dilema: pada emulator, untuk mengakses `localhost` di komputer host, saya harus menggunakan *ip address* `10.0.2.2`.  Bila saya menjalankan *remote debugger* dari host ke Chrome di emulator, saya akan menjumpai pesan kesalahan seperti `Fail to register service worker DOMException: Only secure origins are allowed `.  Hal ini karena selain `localhost`, Chrome mewajibkan situs lain untuk berjalan pada HTTPS!  Karena `10.0.2.2` bukan `localhost`, saya harus mengaktifkan HTTPS bila tetap ingin mencoba fasilitas ini di emulator Android.

Langkah paling awal dalam mengaktifkan HTTPS adalah saya perlu membuat sertifikat *'palsu'*.  Untuk mempermudah proses ini, saya menggunakan script yang ada di `<https://github.com/jsha/minica>`.  Saya membuat sebuah direktori baru bernama `certificates`.  Pada folder ini, saya memberikan perintah:

```
minica --ip-addresses 10.0.2.2
```

Perintah di atas akan menghasilkan dua jenis sertifikat.  Sebuah *root certificate* (beserta *private key*-nya) akan dihasilkan di folder dimana saya menjalankan perintah tersebut.  Kemudian, akan ada folder `10.0.2.2` yang berisi sertifikat yang di-*signed* oleh *root certificate* tersebut (beserta *private key*-nya).  Sertifikat di dalam folder `10.0.2.2` adalah sertifikat yang perlu saya pakai di server Jekyll.  Sementara itu, *root certificate* adalah sertifikat yang perlu saya tambahkan pada Android agar dipercaya oleh Chrome.

Langkah berikutnya, saya perlu mendaftarkan *root certificate* yang dihasilkan oleh Minima sebagai *trusted certificate* di emulator Android.  Untuk melakukan modifikasi ini, saya harus menggunakan emulator dengan target Google APIs dan bukan Google Play.  Hal ini karena emulator dengan target Google Play merupakan *production build* yang tidak bisa di-*root*.  Sementara itu untuk men-install *trusted certificate* pada Android terbaru, saya perlu akses *root*, yang diaktifkan dengan perintah seperti berikut ini:

```
adb root
adb disable-verity
adb remount
adb reboot
```

Masih pada direktori `certificates`, saya memberikan perintah `openssl x509 -hash -in minica.pem -noout` untuk memperoleh nilai hash untuk *root certificate* tersebut (`minica.pem`).  Saya kemudian membuat file dengan isi yang sama dengan `minica.pem` tetapi nama yang sesuai hash dengan perintah `cp minicam.pem <output-hash>.0`.  File ini yang kemudian saya *copy* ke emulator Android: `adb push <output-hash>.0 /system/etc/security/cacerts/`.

Setelah itu, pada emulator Android, saya masuk ke menu **Settings**, **Security & Location**, **Encryption & Credentials**, **Trusted Credentials**.  Bila nama sertifikat `minica root` tidak muncul pada bagian *User*, saya bisa mencarinya di *System*, kemudian men-klik toggle yang ada.  Proses instalasi akan dimulai setelah konfirmasi.

Setelah memastikan *root certificate* sudah menjadi *trusted certificate* di emulator Android, saya segera menjalankan versi HTTPS dari server Jekyll dengan memberikan perintah berikut ini:

```
bundle exec jekyll serve --ssl-cert certificates/10.0.2.2/cert.pem --ssl-key certificates/10.0.2.2/key.pem
```

Kini, saya bisa membuka alamat `https://10.0.2.2:4000` di Chrome seperti pada gambar berikut ini:

![Chrome di emulator Android dengan HTTPS]({{ "/assets/images/gambar_00005.png" | relative_url}}){:class="img-fluid rounded"}

Perhatikan bahwa pada browser Chrome di emulator, terdapat awalan HTTPS dengan simbol kunci hijau.  Ini menunjukkan bahwa pengaturan sertifikat sudah benar.  Sekarang, saya bisa mencoba men-klik link *Install*.  Chrome akan menampilkan notifikasi yang terlihat seperti pada gambar berikut ini:

![Notifikasi instalasi aplikasi di emulator Android]({{ "/assets/images/gambar_00006.png" | relative_url}}){:class="img-fluid rounded"}

Setelah men-klik **Add To Home Screen**, saya menemukan sebuah launcher baru dengan icon seperti berikut ini:

![Shortcut untuk situs di emulator Android]({{ "/assets/images/gambar_00007.png" | relative_url}}){:class="img-fluid rounded"}

Sekarang, saya bisa membuka situs ini tanpa harus melalui browser lagi.