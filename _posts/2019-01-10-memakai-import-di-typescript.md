---
layout: post
category: Pemograman
title: Memakai Import di TypeScript
tags: [JavaScript, TypeScript]
---

Pada saat saya mempelajari bahasa pemograman baru, fokus utama saya adalah bagaimana caranya semudah mungkin menjalankan kode program dan melihat hasilnya.  Saya cenderung menulis kode program dalam satu *function* besar.  Ini bertentangan dengan fokus saya setelah mahir: bagaimana mengetahui cara kerja aplikasi tanpa membaca seluruh kode program dan bagaimana memperbaiki bagian tertentu yang bermasalah tanpa merusak yang lain.  Untuk mencapai tujuan tersebut, saya perlu menerapkan konsep *module*.  Saya bisa mengetahui cara kerja aplikasi secara garis besar dengan melihat komunikasi antar *module*.  Untuk memperbaiki kesalahan atau mengembangkan fitur baru, saya bisa hanya fokus ke kode program di *module* yang bersangkutan.

Pada awalnya, JavaScript tidak memiliki konsep *module*.  Fokus utama JavaScript adalah kemudahan.  Cukup menulis kode program di HTML dan buka di *browser*, maka kode program tersebut akan dikerjakan.  Ini lebih dari cukup untuk menambahkan animasi yang menarik di web.  Akan tetapi, seiring waktu berlalu, JavaScript semakin sering dipakai untuk sesuatu yang lebih besar dan serius seperti *single page application* (SPA).  Konsep *module*-pun mulai diperkenalkan secara tidak resmi seperti Asynchronous Module Definition (AMD), CommonJS, Node.js modules, SystemJS dan Universal Module Definition (UMD).  ES6 pada akhirnya memperkenalkan keyword `export` dan `import` untuk mendukung *module* secara resmi.

Dari teknik *module* non-resmi yang ada, Node.js modules (lebih tepatnya implementasi CommonJS oleh Node) adalah yang paling populer.  Pada Node.js modules, terdapat 3 variabel yang dapat dipakai di kode program: `exports`, `require` dan `module`.  Untuk men-*export* sesuatu, cukup tambahkan pada `exports` seperti `exports.name = 'snake'`.  Sesungguhnya `exports` adalah sebuah *property* di `module`.  Untuk men-*import* sebuah *module*, saya bisa menggunakan `require`.

Sebagai contoh, berikut ini adalah cuplikan kode program `index.js` dari package `escape-html` di `npm`:

```javascript
...
module.exports = escapeHtml;

function escapeHtml(string) {
  ...
}
```

Untuk memakai *module* di atas, saya bisa menggunakan kode program seperti berikut ini:

```javascript
var escapeHtml = require('escape-html');
var u = escapeHtml(address);
```

Lalu bagaimana dengan *module* di TypeScript?  Sama seperti ES6, TypeScript menggunakan keyword `export` dan `import`.  Saya bisa menentukan teknik *module* yang dipakai di file JavaScript hasil kompilasi dengan mengatur nilai `module` di `tsconfig.json`.  Sebagai contoh, pada umumnya saya menggunakan nilai `commonjs` karena saya menggunakan `npm` atau `yarn`.

Bagaimana caranya menggunakan Node.js modules di kode program TypeScript?  Sebagai contoh, saya sudah menambahkan dependency `escape-html` di file `package.json`.  Saya masih bisa menggunakan `require()` tanpa masalah.  Akan tetapi, lebih baik menggunakan `import` yang merupakan keyword resmi di ES6.  Saya bisa menggunakan seperti pada contoh berikut ini:

```typescript
import * as escapeHtml from 'escape-html';
var u = escapeHtml(address);
```

Walaupun kode program di atas bisa berjalan dengan baik, sesungguhnya ia melanggar standar ECMAScript.  `escapeHtml` pada kode program di atas harus berupa *object* dan bukan *function* yang bisa dikerjakan.  Untuk menjaga agar standar ini ditetapkan, saya bisa memberikan nilai `esModuleInterop` berupa `true` di `tsconfig.json`.  Setelah mengaktifkan `esModuleInterop`, saya akan memperoleh kesalahan seperti berikut ini pada saat menjalankan kode program:

```
var u = escapeHtml(address);
        ^

TypeError: escapeHtml is not a function
```

Agar program dapat kembali bekerja, saya perlu mengubahnya menjadi seperti berikut ini:

```typescript
import escapeHtml from 'escape-html';
var u = escapeHtml(address);
```

Kode program di atas menggunakan *default import* yang merupakan bagian dari ES6.  Tujuan dari *default import* adalah untuk mendapatkan *default export*. Pada ES6, *default export* dilakukan dengan menggunakan `export default`.  Tentu saja kebanyakan Node.js modules saat ini tidak memiliki `export default`.  Dengan mengaktifkan `esModuleInterop`, saya seolah-olah bisa melakukan *default import* pada Node.js modules dimana `module.exports =` di Node.js module dianggap sebagai `export default` di ES6.

Contoh lainnnya, saya bisa mengganti kode program seperti berikut ini:

```typescript
import * as admin from 'firebase-admin';
```

menjadi seperti:

```typescript
import admin from 'firebase-admin';
```

Pada kode program di atas, kedua *import* di atas sama-sama valid karena apa yang di-*export* oleh `firebase-admin` adalah sebuah objek.  Walaupun demikian, bila dilihat dari sudut pandang ES6, versi `import * as x from y` dipakai untuk men-*import* seluruh definisi *export* yang ada di sebuah *module*.  Bila saya hanya ingin men-*import* satu *module* saja, terutama *default module*, versi `import x from y` terasa lebih masuk akal.

Sebagai alternatif, saya juga bisa menggunakan *syntax* yang hanya berlaku di TypeScript, seperti:

```typescript
import admin = require('firebase-admin');
```

Dengan asumsi bahwa ES6 akan menjadi standar di masa depan, saya lebih memilih mengaktifkan `esModuleInterop` dan menggunakan *default import* untuk Node.js modules.  Efek sampingnya adalah kode program seperti `import * as x from y` tidak akan bekerja lagi bila `x` bukan sebuah objek.  Bila saya menjumpai kasus dimana saya tidak bisa menggunakan *default import*, saya akan menggunakan `import x = require(y)` sebagai pengganti `import * as x from y`.