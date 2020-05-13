---
layout: post
category: Pemograman
title: Menangkap Kesalahan Saat Menggunakan EventEmitter
tags: [JavaScript, TypeScript]
---

`EventEmitter` merupakan salah satu class penting di Node.js untuk pekerjaan *asynchronous* berbasis *event*.  Salah satu contoh penggunaannya yang paling 
populer adalah sebagai `Stream` seperti pada `fs.ReadStream`, `http2.ServerHttp2Stream`, dan sebagainya.  Tentu saja saya juga bisa membuat class turunan
dari `EventEmitter` untuk keperluan pribadi, misalnya pada contoh kode program berikut ini:

```typescript
class ContohEventEmitter extends EventEmitter {}

const contohEventEmitter = new ContohEventEmitter();
contohEventEmitter.on('event', (pesan) => {
    if (pesan == null) {
        throw new Error(`Pesan tidak boleh kosong!`);
    }
    console.log(`Pesan ${pesan} diproses!`);
});
contohEventEmitter.on('error', (err) => {
    console.error(`Terjadi kesalahan!`, err);
})

contohEventEmitter.emit('event', 'pesan1');
contohEventEmitter.emit('event', null);
contohEventEmitter.emit('event', 'pesan2');
``` 

*Listener* adalah kode program yang akan dikerjakan pada saat sebuah *event* terjadi.  Pada kode program di atas, saya menggunakan method `on()` untuk menambahkan 
*listener* baru di `EventEmitter`.

Untuk menandakan sebuah *event* telah terjadi, saya menggunakan method `emit()` di-ikuti dengan nama *event* yang diinginkan.  Saya juga bisa menyertakan satu atau
  lebih argumen bila dibutuhkan.  Pada contoh kode program di-atas, saya memanggil `emit()` tiga kali, dimana salah satu *event* memiliki argument `null`.
  
Karena terjadi 3 kali `emit()`, seharusnya *listener* dikerjakan 3 kali, bukan?  Namun, pada saat menjalankan kode program, saya menemukan hasil seperti berikut ini:

```
Pesan pesan1 diproses!
Error: Pesan tidak boleh kosong!
```    

Ternyata hanya 1 *event* yang sukses ditangani.  Saya memang melakukan validasi di *listener* yang akan men-*throw* kesalahan bila argument bernilai `null`,
akan tetapi *event* `pesan2` tidak `null`.  Mengapa `pesan2` tidak ditangani?  Ternyata, pada saat terjadi kesalahan, aplikasi langsung *crash*!  

Bila ini bukan sesuatu yang diharapkan, saya bisa menggunakan metode mengirim pesan kesalahan yang direkomendasikan, yaitu dengan men-`emit()` kesalahan tersebut 
dengan *event* berupa simbol `error`.  Sebagai contoh, saya mengubah kode program saya menjadi seperti berikut ini:

```typescript
class ContohEventEmitter extends EventEmitter {}

const contohEventEmitter = new ContohEventEmitter();
contohEventEmitter.on('event', (pesan) => {
    if (pesan == null) {
        contohEventEmitter.emit('error', new Error(`Pesan tidak boleh kosong!`));
        return;
    }
    console.log(`Pesan ${pesan} diproses!`);
});
contohEventEmitter.on('error', (err) => {
    console.error(`Terjadi kesalahan!`, err);
})

contohEventEmitter.emit('event', 'pesan1');
contohEventEmitter.emit('event', null);
contohEventEmitter.emit('event', 'pesan2');
```

Kali ini, bila saya menjalankan kode program di atas, saya akan memperoleh hasil seperti yang diharapkan:

```
Pesan pesan1 diproses!
Terjadi kesalahan! Error: Pesan tidak boleh kosong!
Pesan pesan2 diproses!
```

Bagaimana bila terjadi kesalahan pada saat menangani kesalahan? Aplikasi akan *crash* bila saya men-*throw* `Error` seperti pada contoh kode program berikut ini:

```typescript
contohEventEmitter.on('error', (err) => {
    throw new Error('Terjadi error pada saat menangani error!');
    console.error(`Terjadi kesalahan!`, err);
})
```

Tentu saja bila saya memanggil `contohEventEmitter.emit('error', err)`, maka akan terjadi proses rekursif.  Oleh sebab itu, pada saat menangani kesalahan,
saya akan selalu men-`throw` kesalahan (bila ada kesalahan) dan tidak lagi menghasilkan *event* `error`.

Sekarang ini, `Promise` dan `async` sudah menjadi hal yang umum dijumpai di kode program Node.  Bagaimana bila saya mengubah *listener* menjadi sebuah method `async`,
sehingga saya bisa menggunakan `await` untuk `Promise`?  Sebagai contoh, saya mengubah kode program saya menjadi seperti berikut ini:

```typescript
class ContohEventEmitter extends EventEmitter {}

const contohEventEmitter = new ContohEventEmitter();
contohEventEmitter.on('event', async (pesan) => {
    if (pesan == null) {
        throw new Error('Pesan tidak boleh kosong!');
    }
    console.log(`Pesan ${pesan} diproses!`);
});
contohEventEmitter.on('error', (err) => {
    console.error(`Terjadi kesalahan!`, err);
})

contohEventEmitter.emit('event', 'pesan1');
contohEventEmitter.emit('event', null);
contohEventEmitter.emit('event', 'pesan2');
``` 

Output kode program di atas akan terlihat seperti:

```
Pesan pesan1 diproses!
Pesan pesan2 diproses!
(node:10635) UnhandledPromiseRejectionWarning: Error: Pesan tidak boleh kosong!
```

Kali ini saya akan menemukan bahwa aplikasi tidak *crash*, `pesan1` dan `pesan2` dikerjakan dengan baik, tetapi `error` *listener* tidak dikerjakan sama sekali! `throw`
akan menyebabkan `Promise` di-*reject*, tetapi penolakan tersebut akan diabaikan.  Saya bisa menggantinya dengan `contohEventEmitter.emit('error', err))`.  Akan tetapi,
bila saya menggunakan Node 12.6.0 ke atas, saya bisa memanfaatkan fasilitas `captureRejections` tanpa harus mengubah kode program yang ada.

<div class="alert alert-info" role="alert">
    Fitur <code>captureRejections</code> tersedia untuk Node versi 12.6.0 ke atas. 
</div>

Bila nilai `captureRejections` adalah `true`, maka `Promise` yang di-*reject* akan secara otomatis diterjemahkan menjadi *event* `error`.  Agar lebih jelas, saya akan
mengubah kode program saya menjadi seperti berikut ini:

```typescript
class ContohEventEmitter extends EventEmitter {
    constructor() {
        super({captureRejections: true});
    }
}

const contohEventEmitter = new ContohEventEmitter();
contohEventEmitter.on('event', async (pesan) => {
    if (pesan == null) {
        throw new Error('Pesan tidak boleh kosong!');
    }
    console.log(`Pesan ${pesan} diproses!`);
});
contohEventEmitter.on('error', (err) => {
    console.error(`Terjadi kesalahan!`, err);
})

contohEventEmitter.emit('event', 'pesan1');
contohEventEmitter.emit('event', null);
contohEventEmitter.emit('event', 'pesan2');
``` 

Walaupun memakai `throw`, kali ini saya tetap mendapatkan hasil yang diharapkan:

```
Pesan pesan1 diproses!
Pesan pesan2 diproses!
Terjadi kesalahan! Error: Pesan tidak boleh kosong!
```

Pada contoh di atas, kebetulan saya menggunakan `EventEmitter` sendiri (`ContohEventEmitter`) sehingga saya bisa melewatkan nilai `captureRejections` pada
*constructor*.  Bagaimana bila saya tidak memiliki akses untuk mengubah kode program `EventEmitter` yang hendak dipakai?  Ini adalah hal yang umum pada saat 
memakai `EventEmitter` dari pihak ketiga. Untuk keperluan tersebut, saya bisa mengaktifkan `captureRejections` secara global dengan menambahkan baris berikut ini
sebelum menggunakan `EventEmitter` tersebut:

```typescript
(EventEmitter as any).captureRejections = true;
``` 

Bagaimana bila terjadi kesalahan pada *listener* untuk *event* `error` itu sendiri?  Bila seandainya *listener* tersebut adalah `async` seperti:

```typescript
contohEventEmitter.on('error', async (err) => {
    throw new Error('Terjadi kesalahan pada saat menangani kesalahan!');
    console.error(`Terjadi kesalahan!`, err);
})
```

maka kesalahan yang timbul dari `async` *listener* tersebut akan diabaikan dengan status `UnhandledPromiseRejectionWarning`.  Oleh sebab itu, disarankan untuk 
tidak menggunakan `async` *listener* pada saat menangani kesalahan.