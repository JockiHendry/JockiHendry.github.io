---
layout: post
category: Pemograman
title: Memakai Promise.all() atau await?
tags: [JavaScript, TypeScript]
---

Dengan TypeScript, saya tidak ragu lagi menggunakan fasilitas `async/await` tanpa perlu khawatir masalah kompatibilitas JavaScript.  Kode program terasa lebih singkat dan lebih mudah dipahami tanpa membuat banyak `Promise`.  Walaupun demikian, dalam kasus tertentu, saya tetap menggunakan `Promise.all()` yang memiliki efek samping berbeda bila digantikan dengan `async/await`.

Sebagai contoh, saya melakukan query ke Firestore yang berisi ratusan `items`.  Tujuannya adalah memperbaharui nilai `qty` untuk masing-masing *item* yang ada di `items` (mengingat Firestore tidak mendukung agregasi seperti *sum* secara bawaan).  Berikut ini adalah contoh kode program yang menggunakan `async/await`:

```javascript
const items = (await firestore.collection('items').get()).docs;
for (const item of items) {
    await firestore.runTransaction(async transaction => {
        // Melakukan proses yang cukup lama
        // ...
        //        
    });
    console.log(`Item ${item} berhasil diperbaharui!`);
}
```

Salah satu efek samping dari kode program di atas adalah masing-masing item akan dikerjakan secara berurutan.  Pada awalnya, proses untuk item pertama akan dikerjakan terlebih dahulu.  `await` akan menunggu!  Setelah selesai, item kedua akan dikerjakan. `await` kembali menunggu.  Dan begitu selanjutnya hingga item terakhir.  Hal ini terlihat seperti hasil `console.log()` program di atas:

```
Item item1 berhasil diperbaharui!
Item item2 berhasil diperbaharui!
Item item3 berhasil diperbaharui!
Item item4 berhasil diperbaharui!
Item item5 berhasil diperbaharui!
Item item6 berhasil diperbaharui!
Item item7 berhasil diperbaharui!
```

Sekarang, bandingkan dengan versi yang menggunakan `Promise.all()`:

```javascript
const items = (await firestore.collection('items').get()).docs;
const tasks = [];
items.forEach(item => {
    const task = new Promise(async resolve => {
        await firestore.runTransaction(async transaction => {
            // Melakukan proses yang cukup lama
            // ...
            //
        });
        console.log(`Item ${item} berhasil diperbaharui!`);
        resolve();
    });
    tasks.push(task);
});
await Promise.all(tasks);
```

Walaupun kode program di atas terlihat lebih rumit bila dibandingkan dengan sebelumnya, kali ini eksekusi pemrosesan untuk masing-masing item akan dikerjakan secara bersamaan (paralel).  Ini membuat kode program berjalan lebih cepat.  Hal ini juga terlihat dari hasil `console.log()`:

```
Item item3 berhasil diperbaharui!
Item item4 berhasil diperbaharui!
Item item6 berhasil diperbaharui!
Item item1 berhasil diperbaharui!
Item item2 berhasil diperbaharui!
Item item7 berhasil diperbaharui!
Item item5 berhasil diperbaharui!
```

Salah satu efek samping dari `Promise.all()` adalah bila salah satu `Promise` gagal atau mengembalikan kesalahan, maka `Promise` lainnya yang masih belum dijalankan tidak akan dikerjakan lagi.  Ini merupakan salah satu pertimbangan penting dalam memilih menggunakan `Promise.all()` atau `await`.