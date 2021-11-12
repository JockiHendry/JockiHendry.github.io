---
layout: post
category: Pemograman
title: Memakai Shared Module Di Monorepo TypeScript Untuk Firebase Functions
tags: [FirebaseFunction, TypeScript]
---

Hari ini saya kembali menemukan sesuatu yang secara konseptual seharusnya mudah diterapkan, tetapi begitu dikerjakan, ternyata tidak sesederhana yang saya bayangkan.  Pada sebuah kode program monorepo, saya menerapkan *shared module* yang didukung oleh Node.js.  Kode program bisa berjalan saat dikerjakan oleh `node` di komputer lokal, tapi ini tidak akan bekerja saat saya men-*deploy* kode program tersebut di Firebase Functions. Mengapa demikian?

Untuk menunjukkan permasalahan ini, saya membuat sebuah monorepo sederhana yang berisi 3 subproyek: `serverless-app1`, `serverless-app2` dan `shared`.  Struktur direktorinya terlihat seperti berikut ini:

<div class="diagram">
. monorepo
├── serverless-app1  
│   └── functions    
│       ├── src      
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── serverless-app2  
│   └── functions    
│       ├── src      
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
└── shared  
    ├── src    
    │   └── util.ts
    ├── package.json      
    └── tsconfig.json  
</div>

File `util.ts` di subproyek `shared` berisi kode program yang bisa dipakai ulang di subproyek lainnya:

```typescript
export class Util {

  static log(message: string): void {
    console.log(message);
  }

}
```

Sebagai contoh, di folder `serverless-app1` dan `serverless-app2`, saya menggunakan kode program berikut ini di `index.ts`:

```typescript
import * as functions from 'firebase-functions';
import {Util} from '../../../shared/src/util';

export const app1 = functions.https.onRequest((request, response) => {
  Util.log('Hello serverless-app1!');
  response.send("Hello serverless-app1!");
});
```

Memakai ulang kode program seperti ini sebenarnya tidak masalah karena Node.js mendukung `import` dari folder mana saja.  Untuk membuktikannya, bila saya mengerjakan `npm run build`, kode program berhasil dikompilasi tanpa pesan kesalahan.  Hasil kompilasi di folder `lib` terlihat seperti:

<div class="diagram">
. lib
├── serverless-app1
│   └── functions
│       └── src
│           └── index.js
└── shared
    └── src
        └── util.js
</div>

Bila saya membandingkan nilai `main` di `package.json` yang berupa `"lib/index.js"`, terlihat bahwa struktur proyek yang dihasilkan tidak sesuai dengan yang dibutuhkan.  Ini menyebabkan `firebase deploy` akan gagal dengan pesan kesalahan seperti **functions/lib/index.js does not exists, can't deploy Cloud Functions**.

Mengapa TypeScript menghasilkan struktur proyek seperti ini?  Bila nilai `rootDir` tidak disertakan di `tsconfig.json`, TypeScript akan berusaha mencari folder paling atas yang mengandung seluruh file yang dibutuhkan (berdasarkan `import`) sebagai nilai `rootDir`.  Dalam hal ini, nilai `rootDir` adalah folder `monorepo`.  Ini yang menyebabkan struktur proyek hasil kompilasi terlihat aneh.  Namun bila saya memberikan nilai `rootDir` di `tsconfig.json` berupa `../../serverless-app1`, proses kompilasi akan gagal dengan pesan kesalahan seperti **'monorepo/shared/src/util.ts' is not under 'rootDir'. 'rootDir' is expected to contain all source files**.  Mengisi nilai `rootDir` juga bukan sebuah solusi!

Cara yang paling sederhana untuk mengatasi hal ini adalah dengan mengubah nilai `main` di `package.json` menjadi `lib/serverless-app1/functions/src/index.js`.  Bergantung pada deteksi `rootDir` secara otomatis akan memberikan hasil yang membingungkan karena nilai `rootDir` dapat berubah2 tergantung pada isi kode program (apa saja yang di-`import`) sehingga nilai `main` bisa jadi tidak valid lagi (bila baris seperti `import {Util} from '../../../shared/src/util` dihapus).  Oleh sebab itu, saya juga perlu mengisi nilai `rootDir` menjadi `../..` di `tsconfig.json`.  Setelah ini, proyek dapat di-*build* dengan baik dan di-*deploy* dengan lancar.

Walaupun sudah bekerja, ini bukanlah solusi yang terbaik karena proses kompilasi sebenarnya dilakukan oleh `serverless-app1` (dimana kode program `shared` disertakan sebagai bagian dari `serverless-app1` saat proses kompilasi).  Ini melanggar prinsip enkapsulasi dan terkadang membingungkan IDE dalam memberikan *content assist*.  Cara yang lebih baik adalah menggunakan fitur *project references* di TypeScript.  Sayangnya, saya tidak menemukan cara gampang untuk menggunakan *project references* untuk proyek Firebase Functions karena keterbatasan Cloud Functions dimana seluruh kode program yang hendak di-*deploy* harus berada di folder proyek (wajib berada di dalam folder `serverless-app1` yang berisi `firebase.json`).  Satu-satunya cara yang ideal yang masih bisa bekerja dengan Firebase Functions adalah men-*deploy* proyek `shared` ke private `npm` registry yang nantinya dipakai sebagai *dependency* di `package.json` milik `serverless-app1` dan `serverless-app2`.  Ini bukanlah hal yang rumit mengingat kini ada beberapa alternatif private registry `npm` gratis (atau murah) seperti [Github Packages](https://github.com/features/packages) dan [GCP Artifact Registry](https://cloud.google.com/artifact-registry). 