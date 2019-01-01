---
layout: post
category: Pemograman
title: Membuat Online Unit Test Pada TypeScript Firebase
tags: [Firebase, FirebaseFunction, Firestore, TypeScript]
---

Cloud Functions For Firebase dapat dipakai untuk banyak hal di Firebase, mulai dari *trigger* untuk Firestore, Cloud Storage, Cloud Pub/Sub hingga melayani request HTTP langsung dari pengguna (HTTP *trigger*).  Pada saat tulisan ini dibuat, secara default, eksekusi Cloud Functions akan dikerjakan oleh Node.js 6.   Karena saya adalah penggemar TypeScript dan pada dasarnya TypeScript kompatibel dengan JavaScript, saya selalu berusaha sebisa mungkin menggunakan TypeScript sebagai bahasa untuk Cloud Functions.  Untuk membuat proyek Cloud Functions For Firebase yang menggunakan TypeScript, saya bisa mengikuti contoh di [GitHub TypeScript getting-started](https://github.com/firebase/functions-samples/tree/master/typescript-getting-started).

Satu hal yang masih kurang pada contoh di repository GitHub tersebut adalah *unit testing*.  Sebagai programmer yang mengikuti filosofi *agile*, saya selalu menulis *unit test* di semua proyek yang saya tulis.  Bukan hanya membantu saya mencegah terjadinya kesalahan akibat perubahan kode program di kemudian hari, *unit test* juga membantu saya dalam melakukan eksplorasi teknologi yang sedang saya pakai.  Sebagai contoh, dengan Webstorm, saya bisa melakukan *debugging* unit test dengan men-klik icon *launcher* di samping sebuah kode program *test case* seperti yang terlihat pada gambar berikut ini:

![Melakukan debugging pada unit test]({{ "/assets/images/gambar_00024.png" | relative_url}}){:class="img-fluid rounded"}

Setelah itu, saya bisa meletakkan *breakpoint* dan memilih menu **Run**, **Evaluate Expressions...** untuk mempelajari isi dari variabel atau mengerjakan *method* untuk sebuah object, seperti yang terlihat pada gambar berikut ini:

![Melakukan inspeksi pada saat debugging]({{ "/assets/images/gambar_00025.png" | relative_url}}){:class="img-fluid rounded"}

Fasilitas seperti ini sangat berguna bagi saya terutama pada bahasa dinamis dimana struktur sebuah object bisa saja berubah tergantung pada kondisi yang mungkin saya belum ketahui.

Lalu bagaimana cara membuat *unit test* untuk proyek Cloud Functions for Firebase yang menggunakan bahasa TypeScript?  Saya menemukan sebuah contoh *unit test* di [repository GitHub berikut ini](https://github.com/firebase/functions-samples/tree/master/quickstarts/uppercase/functions).  Sayangnya, ini adalah contoh yang menggunakan JavaScript dan bukan TypeScript.  Walaupun demikian, seharusnya teknik yang digunakan tidak banyak berbeda.  Saya tetap menggunakan [Firebase Test SDK for Cloud Functions](https://github.com/firebase/firebase-function-test).  Saya pun segera menambahkan *devDependency* berikut ini pada pada *npm* di proyek saya:

```
"firebase-functions-test": "^0.1.6",
"@types/chai": "^4.1.7",
"@types/mocha": "^5.2.5",
"chai": "^4.2.0",
"mocha": "^5.2.0",
"mocha-typescript": "^1.1.17",
"ts-node": "^7.0.1",
```

Mocha adalah framework pengujian yang saya pakai.  Anggap saja seperti JUnit di dunia Java.  Mocha memiliki konsep *interface* dimana pengguna bisa memilih bagaimana cara mendeklarasikan kode program *test case* mereka.  Yang paling umum dipakai adalah BDD yang menggunakan DSL seperti `describe` dan `it`.  Saya akan menggunakan *interface* `mocha-typescript` yang menggunakan *class* dan *decorator* sehingga lebih mirip seperti JUnit di Java.

Chai sendiri adalah sebuah *assertion library* yang memungkinkan saya menulis *assertion* di *test case* dalam bentuk `expect(a).to.be.an('array')`.  Chai memiliki dua jenis gaya: `expect` dan `should`.  Versi yang menggunakan `should` akan terlihat seperti `a.should.be.an('array')`.  Saya lebih memilih menggunakan `expect` karena lebih mudah bagi Webstorm untuk menampilkan *content assist* saat saya menuliskan kode program *test case*.

Firebase memungkinkan dua jenis pengujian: *online* atau *offline*.  Pengujian *online* akan menghubungi server Firebase secara langsung, misalnya benar-benar melakukan penulisan database dan membuat user baru.  Walaupun pengujian *online* lebih akurat, saya harus melakukan langkah pembersihan supaya kondisi database tetap kosong (atau konsisten) setiap kali pengujian dikerjakan.  Pengujian *offline* dilakukan dengan melakukan *stubbing* sehingga tidak benar-benar menghubungi server Firebase.

Pada contoh ini, saya akan melakukan pengujian *online*.  Untuk itu, saya membuat sebuah proyek Firebase baru yang khusus dipakai untuk melakukan pengujian.  Saya juga perlu men-*export* *private key* untuk *service account* Firebase Admin dengan memilih menu **Settings**, **Service accounts** di dashboard Firebase proyek tersebut.  Setelah men-klik tombol **Generate new private key**, saya akan memperoleh sebuah file JSON yang perlu saya letakkan di folder yang berisi *test suite* saya.

Saya kemudian membuat sebuah class TypeScript dengan nama `AbstractTestBase` yang berisi kode program seperti berikut ini:

```typescript
import * as firebase_functions_test from "firebase-functions-test";
import {FeaturesList} from "firebase-functions-test/lib/features";

export abstract class AbstractTestBase {

    protected firebaseTest: FeaturesList;

    public before() {
        this.firebaseTest = firebase_functions_test({
            databaseURL: "https://nama-proyek-test.firebaseio.com",
            projectId: "nama-proyek-test",
            storageBucket: "",
        }, './test/<sesuaikan>.json');
    }

    public async after() {
        this.firebaseTest.cleanup();
    }

}
```

Method `before()` dan `after()` akan dikerjakan secara otomatis sebelum dan sesudah masing-masing *test case*.  Pada kode program di atas, `firebase_functions_test()` akan menciptakan sebuah Firebase App baru yang khusus dipakai untuk pengujian.  Perlu diperhatikan bahwa pada kode program tersebut, saya menambahkan referensi ke *private key* milik *service account* Firebase Admin.  Dengan demikian, berbeda dengan akses Firebase dari *front end* yang dibatasi oleh *rules*, Firebase App ini memiliki hak akses tidak terbatas.

Saya menemukan bahwa  ada kalanya saya perlu mengakses Firebase App pengujian tersebut.  Sebagai contoh, terkadang saya perlu menambahkan *document* baru di Firestore sebelum pengujian dimulai.  Agar ini bisa dilakukan, saya perlu mempublikasikan Firebase App dan/atau Firestore sehingga bisa diakses oleh kode program pengujian.  Untuk itu, saya menambahkan kode program berikut ini:

```typescript
import * as firebase_functions_test from "firebase-functions-test";
import * as app from 'firebase-functions-test/lib/app';
import * as admin from "firebase-admin";
import {FeaturesList} from "firebase-functions-test/lib/features";

export abstract class AbstractTestBase {

    ...
    protected firestore: admin.firestore.Firestore;

    public before() {
        ...
        // noinspection TypeScriptValidateJSTypes
        this.firestore = (app as any).testApp().getApp().firestore();
        this.firestore.settings({
            timestampsInSnapshots: true
        });
    }
    ...
}
```

Pada kode program di atas, saya menambahkan pengaturan `timestampsInSanpshots` sesuai dengan yang saya pakai di aplikasi.  Ini adalah nilai yang direkomendasikan supaya semua nilai tanggal dikembalikan dalam tipe `Timestamp` dan bukan `Date`.

Sebagai pelengkap, akan lebih baik bila saya selalu menghapus isi database Firestore setiap kali pengujian dimulai.  Untuk itu, saya bisa mensimulasikan perintah `firebase firestore:delete --all-collections`.  Saya akan mulai dengan menambahkan *dependency* ke `firebase-tools`.  Setelah itu, saya menambahkan kode program berikut ini:

```typescript
...
import * as firebase_tools from "firebase-tools";

export abstract class AbstractTestBase {

    ...

    public async before() {
        ...

        // Delete all collections in Firestore
        await firebase_tools.firestore.delete('', {
            project: 'nama-proyek-test',
            allCollections: true,
            recursive: true,
            yes: true,
        });
    }

    ...

}
```

Sekarang, saya siap untuk membuat *test suite* baru.  Sebagai contoh, saya memiliki sebuah *trigger* dimana setiap kali *document* di *collection* `sales` dibuat, nilai `qty` untuk *document* yang bersangkutan di *collection* `items` akan diperbaharui.  Untuk menguji apakah kode program tersebut bekerja, saya akan membuat class yang berisi kode program berikut ini:

```typescript
import {suite, test, timeout} from "mocha-typescript";
import {AbstractTestBase} from './test';
import * as stockFunctions from '../src/stock';
import {expect} from 'chai';

@suite(timeout(20000)) class Stock extends AbstractTestBase {

    @test async increaseStockOnNewSales() {
        // Create items
        await this.firestore.doc('items/1').set({
            id: '1',
            sku: 'ITEM-1',
            name: 'item1',
            category: 'cat1',
            qty: 100,
        });

        //  Create new sales
        const salesOrderSnapshot = this.firebaseTest.firestore.makeDocumentSnapshot({
            id: 1,
            number: 'INVOICE-123',
            lineItems: [{
                item: {
                    id: '1',
                    sku: 'ITEM-1',
                    name: 'item1',
                    category: 'cat1'
                },
                qty: 10 ,
                rate: 1000,
                amount: 10000,
            }],
            amount: 10000,
        }, 'sales_orders/1');
        const wrapped = this.firebaseTest.wrap(stockFunctions.addStocksForSales);
        await wrapped(salesOrderSnapshot);

        // Check the result
        const item1 = await this.firestore.doc('items/1').get();
        expect(item1.data().qty).to.equal(90);
    }

}
```

Pada kode program di atas, saya membuat sebuah *document* baru di `items/1` dengan nilai `qty` sebesar `100`.  Setelah itu, saya menggunakan `makeDocumentSnapshot()` dari `firebase-functions-test` untuk menciptakan sebuah *document* virtual yang bisa saya berikan sebagai argumen dari *trigger* yang hendak saya uji.  Setelah `firebase-functions-test` mengerjakan *trigger* tersebut, saya kemudian memeriksa apakah nilai `qty` dari `items/1` berkurang menjadi `90`.

Sebagai langkah terakhir, agar saya bisa menjalankan *test suite* secara mudah dari Webstorm, saya memilih menu **Run**, **Edit Configurations...** di Webstorm.  Pada dialog yang muncul, saya memilih **Templates**, **Mocha**.  Saya kemudian mengisi nilai yang ada seperti yang terlihat pada gambar berikut ini:

![Pengaturan Mocha Secara Global]({{ "/assets/images/gambar_00026.png" | relative_url}}){:class="img-fluid rounded"}

Setelah ini, saya bisa menjalankan sebuah *test suite* dengan men-klik icon *launcher* yang ada di baris yang sama dengan nama *class* atau menjalankan *test case* dengan men-klik icon *launcher* di baris yang sama dengan nama *method*.  Webstorm kemudian akan menampilkan hasil pengujian seperti yang terlihat pada gambar berikut ini:

![Hasil pengujian di Webstorm]({{ "/assets/images/gambar_00027.png" | relative_url}}){:class="img-fluid rounded"}