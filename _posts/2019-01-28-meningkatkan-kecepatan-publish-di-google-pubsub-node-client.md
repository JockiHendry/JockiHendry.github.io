---
layout: post
category: Pemograman
title: Mengatasi Publish Yang Lambat Di GooglePub/Sub Node.js
tags: [GoogleCloudPlatform, TypeScript]
---

Google Pub/Sub adalah layanan *messaging* atau apa yang sering dikenal sebagai *message queue* seperti Apache ActiveMQ, Apache Kafka, dan sebagainya.  Salah satu perbedaan utamanya adalah Google Pub/Sub merupakan bagian dari Google Cloud Platform dan memiliki peran penting dalam komunikasi layanan Google Cloud Platform lainnya.  Saya sering menggunakannya sebagai *trigger* untuk Cloud Firestore dan juga komunikasi *asynchronous* dari satu *service* ke *service* lainnya pada aplikasi yang menerapkan arsitektur *microservices*.

Pada suatu hari, saya menulis kode program Firebase Function yang mem-*publish* cukup banyak *message* dalam waktu yang singkat.  Karena ini adalah program Node, saya menggunakan library client Node.js yang bisa dijumpai di <https://github.com/googleapis/nodejs-pubsub>.  Sebagai contoh, kode program sederhananya terlihat seperti berikut ini:


```typescript
import * as functions from 'firebase-functions';
import {PubSub} from '@google-cloud/pubsub';

const pubSub = new PubSub();

export const exercise1 = functions.https.onRequest(async (req, res) => {
    for (let i=0; i<1000; i++) {
        await pubSub.topic('exercises').publishJSON({message: `This is sample message ${i}`});
        console.log(`Message ${i} has been published`);
    }
    res.sendStatus(200);
});
```

Salah satu kelebihan menggunakan Google Pub/Sub pada Google Cloud Platform adalah saya tidak perlu khawatir dengan masalah *credentials* lagi.  Saya hanya perlu membuat *instance* baru dari `PubSub`.  Bila kode program ini perlu dijalankan diluar Google Cloud Platform, saya perlu menggunakan *service account* (demi alasan keamanan) dan memberi tahu *project id* dimana Google Pub/Sub berada.

Kode program di atas cukup sederhana, bukan?  Saya hanya men-*publish* 1.000 *message* di topic bernama `exercises`.  Akan tetapi, alangkah terkejutnya saya saat eksekusi *function* tersebut membutuhkan waktu lama hingga saya mendapatkan error 408 (Request Time-Out).  Yup, secara *default*, sebuah *function* memiliki batas waktu 1 menit.  Saya bisa meningkatkan batas waktu (maksimum hingga 9 menit) dengan meng-*edit* deklarasi *function* tersebut di dashboard Google Cloud Platform seperti yang terlihat pada gambar berikut ini:

![Meningkatkan Batas Waktu Di Google Cloud Functions]({{ "/assets/images/gambar_00028.png" | relative_url}}){:class="img-fluid rounded"}

Walaupun demikian, *function* tersebut tetap saja *timeout*!  Mengapa demikian?  Hal ini tidak pernah saya jumpai pada *message queue* lainnya!  Hasil pantauan Stackdriver Monitoring menunjukkan kecepatan operasi *publish* hanya sekitar satu *message* per menit, seperti yang terlihat pada gambar berikut ini:

![Grafis Untuk Metric Publish Requests]({{ "/assets/images/gambar_00029.png" | relative_url}}){:class="img-fluid rounded"}

Setelah mencari tahu lebih banyak tentang permasalahan ini, saya menemukan bahwa penyebabnya terletak di *client library* Node.js yang saya pakai.  Ternyata *client library* tersebut secara *default* melakukan *batching* dengan pengaturan seperti berikut ini:

```javascript
const defaults = {
    batching: {
        maxBytes: Math.pow(1024, 2) * 5,
        maxMessages: 1000,
        maxMilliseconds: 100,
    },
};
```

Dengan demikian, saat saya memanggil `pubSub.topic('exercises').publishJSON({...})`, operasi *publish* sebenarnya tidak langsung dikerjakan! *Client library* akan menunggu hingga jumlah *message* mencapai 1.000 pesan atau 100 ms telah berlalu atau ukuran pesan yang di-*batch* sudah mencapai 5 MB.  Bila salah satu dari kondisi tersebut tercapai, operasi *publish* yang sesungguhnya baru akan dilakukan!  Ini adalah sebuah optimalisasi yang pintar di sisi *client*.  Walaupun demikian, akan lebih baik bila *batching* hanya aktif saat ditentukan oleh programmer secara eksplisit.  Bayangkan bila sebuah driver JDBC secara otomatis mengaktifkan *transaction* secara otomatis untuk setiap SQL INSERT atau UPDATE, ini akan sangat membingungkan programmer!

Mengapa lambat?  Karena setiap `pubSub.topic()` akan menciptakan sebuah *queue* baru untuk *topic* tersebut (lebih tepatnya *publisher* yang berhubungan dengan *topic* tersebut).  Dengan demikian, masing-masing `pubSub.topic('exercises').publishJSON({...})` akan menunggu hingga 100ms sebelum mengirimkan *message* ke server Pub/Sub.

Sebagai solusinya, saya mengubah kode program saya yang sebelumnya menjadi seperti berikut ini:

```typescript
import * as functions from 'firebase-functions';
import {PubSub} from '@google-cloud/pubsub';

const pubSub = new PubSub();

export const exercise1 = functions.https.onRequest(async (req, res) => {
    const topic = pubSub.topic('exercises', {
        batching: {
            maxMessages: 1,
            maxMilliseconds: 1,
        }
    });
    for (let i=0; i<1000; i++) {
        await topic.publishJSON({message: `This is sample message ${i}`});
        console.log(`Message ${i} has been published`);
    }
    res.sendStatus(200);
});
```

Pada kode program di atas, saya mematikan fasilitas *batching* dan menggunakan *publisher* yang sama untuk men-*publish* seluruh *message* yang ada.  Sekarang, *function* di atas berhasil selesai dikerjakan hanya dalam waktu 30 detik.  Jauh lebih cepat dibandingkan dengan sebelumnya!