---
layout: post
category: Pemograman
title: Event Loop Di Node.js
tags: [JavaScript]
---

Walaupun Node.js tidak mendukung *multi-threading*, ia memiliki implementasi *event loop* untuk mengerjakan kode program secara 
*asynchronous*. Sebenarnya kemampuan mengerjakan kode program secara *asynchronous* tidak ada kaitannya dengan *threading*, tetapi 
dalam banyak hal, saya tidak perlu tahu lebih detail.  Selama kode program bisa dijalankan secara *asynchronous* (misalnya melalui 
`Promise` dan *timer*), saya tidak pernah harus mengetahui implementasi detail *event loop* di Node.js. Akan tetapi, saat saya mencoba 
menerapkan konsep *worker* (yang umum dipakai di bahasa *multi-threading*) dengan menggunakan `Promise`, saya mulai menemukan banyak masalah.
Sebagai contoh, saya membuat kode program seperti berikut ini:

```typescript
import {EventEmitter} from 'events';

async function publishEvent(workerId: string, iterationNumber: number) {
    console.log(`[${new Date().toLocaleString()}][${workerId}] Mengirim pesan [${iterationNumber}] ke PubSub`);
}

function start(workerId: string) {
    let iterationNumber = 0;
    setInterval(async () => {
        iterationNumber++;
        console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber}`);
        await publishEvent(workerId, iterationNumber);
    }, 1000);
}

async function main() {
    const emitter = new EventEmitter();
    emitter.on('start', async workerId => {
        start(workerId);
    });
    emitter.emit('start', 'worker1');
    emitter.emit('start', 'worker2');

}

main().then(() => 'Mulai').catch(err => console.error(err));

setInterval(() => console.log(`[${new Date().toLocaleString()}] Tick!`), 1000);
```

Hasilnya pada saat dijalankan akan terlihat seperti berikut ini:

```
[00:26:45][worker1] Iterasi 1
[00:26:45][worker1] Mengirim pesan [1] ke PubSub
[00:26:45][worker2] Iterasi 1
[00:26:45][worker2] Mengirim pesan [1] ke PubSub
[00:26:45] Tick!
[00:26:46][worker1] Iterasi 2
[00:26:46][worker1] Mengirim pesan [2] ke PubSub
[00:26:46][worker2] Iterasi 2
[00:26:46][worker2] Mengirim pesan [2] ke PubSub
[00:26:46] Tick!
[00:26:47][worker1] Iterasi 3
[00:26:47][worker1] Mengirim pesan [3] ke PubSub
[00:26:47][worker2] Iterasi 3
[00:26:47][worker2] Mengirim pesan [3] ke PubSub
[00:26:47] Tick!
```

Pada bahasa yang mendukung *multi-threading* seperti Java, kode program untuk `worker1` dan `worker2` akan bekerja di *thread* masing-masing.
Sebagai contoh, berikut ini adalah versi Java-nya:

```java
import java.time.LocalTime;
import java.util.Timer;
import java.util.TimerTask;

public class WorkerThread extends Thread {

    private final String workerId;
    private int iterationNumber = 0;

    public WorkerThread(String workerId) {
        this.workerId = workerId;
    }

    @Override
    public void run() {
        new Timer().scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                System.out.printf("[%s][%s] Mengirim pesan [%d] ke PubSub%n", workerId, LocalTime.now(), iterationNumber);
                iterationNumber++;
            }
        }, 0, 1000);

    }

    public static void main(String[] args) {
	    new WorkerThread("worker1").start();
	    new WorkerThread("worker2").start();
    }
}
```

Hasil eksekusi program di atas akan terlihat seperti:

```
[worker1][00:00:51.004] Mengirim pesan [0] ke PubSub
[worker2][00:00:51.004] Mengirim pesan [0] ke PubSub
[worker1][00:00:51.956] Mengirim pesan [1] ke PubSub
[worker2][00:00:51.956] Mengirim pesan [1] ke PubSub
[worker2][00:00:52.956] Mengirim pesan [2] ke PubSub
[worker1][00:00:52.956] Mengirim pesan [2] ke PubSub
[worker1][00:00:53.956] Mengirim pesan [3] ke PubSub
[worker2][00:00:53.956] Mengirim pesan [3] ke PubSub
[worker2][00:00:54.956] Mengirim pesan [4] ke PubSub
[worker1][00:00:54.956] Mengirim pesan [4] ke PubSub
[worker1][00:00:55.956] Mengirim pesan [5] ke PubSub
[worker2][00:00:55.956] Mengirim pesan [5] ke PubSub
```

Keduanya terlihat sama, bukan? Node.js dapat mencapai hal yang sama dengan mengerjakan kode program di `setInterval()` dan `Promise` 
secara silih berganti di dalam *event loop*. Setiap detik, `worker1` dan `worker2` tetap akan mengirim pesan ke PubSub.
Walaupun demikian, kode program Node.js saya ternyata memiliki banyak masalah tersembunyi! Masalah ini muncul karena mereka sebenarnya
dikerjakan silih berganti, dan bukan secara paralel seperti seharusnya di bahasa *multi-threaded*.

Sebagai contoh, apa yang terjadi bila `worker1` mengalami kendala, misalnya bekerja terlalu lambat?  Pada versi *multi-threaded* di Java, 
thread `worker2` akan tetap berjalan seperti biasanya dan tidak dipengaruhi oleh `worker1` sama sekali.  Untuk membuktikannya, saya menambahkan 
*infinite loop* di `worker1` sehingga kode program Java saya terlihat seperti:

```java
@Override
public void run() {
    new Timer().scheduleAtFixedRate(new TimerTask() {
        @Override
        public void run() {
            System.out.printf("[%s][%s] Mengirim pesan [%d] ke PubSub%n", workerId, LocalTime.now(), iterationNumber);
            iterationNumber++;
            if (workerId.equals("worker1")) {
                while (true);
            }
        }
    }, 0, 1000);
}
```

Hasil eksekusi program Java akan terlihat seperti:

```
[worker2][00:00:07.921] Mengirim pesan [0] ke PubSub
[worker1][00:00:07.921] Mengirim pesan [0] ke PubSub
[worker2][00:00:08.872] Mengirim pesan [1] ke PubSub
[worker2][00:00:09.873] Mengirim pesan [2] ke PubSub
[worker2][00:00:10.872] Mengirim pesan [3] ke PubSub
[worker2][00:00:11.872] Mengirim pesan [4] ke PubSub
[worker2][00:00:12.872] Mengirim pesan [5] ke PubSub
```

Tidak ada keluaran dari `worker1` lagi selain baris kedua.  Hal ini karena `worker1` tertunda oleh `while (true);` yang tidak akan 
pernah selesai dikerjakan.  Walaupun demikian, `worker2` tidak terpengaruh dan tetap mengirim pesan ke PubSub setiap detik-nya.

Bagaimana dengan versi Node.js?  Untuk mencobanya, saya mengubah kode program JavaScript saya menjadi seperti:

```typescript
function start(workerId: string) {
    let iterationNumber = 0;
    setInterval(async () => {
        iterationNumber++;
        console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber}`);
        await publishEvent(workerId, iterationNumber);
        if (workerId === 'worker1') {
            while (true);
        }
    }, 1000);
}
```

Hasilnya terlihat seperti berikut ini:

```
[00:00:26][worker1] Iterasi 1
[00:00:26][worker1] Mengirim pesan [1] ke PubSub
```

Setelah `worker1` terblokir oleh `while (true);`, seluruh proses akan tertunda, termasuk `worker2`.  Hal ini yang disebut sebagai 
"memblokir *event loop*".  Kinerja aplikasi Node.js tersebut secara keseluruhan akan terkena dampaknya walaupun hanya satu operasi *asynchronous*
yang lambat.

Pada dunia nyata, jeda bukanlah sesuatu yang bisa dihindari, terutama bila berhadapan dengan I/O.  Agar lebih realistis, saya 
akan mengubah `while (true);` menjadi sebuah *looping* yang lama seperti `for (let a = 0; a < 9999999999; a++);`.  Ketika menjalankan program
 kembali, saya akan memperoleh hasil seperti:

```
[00:01:56][worker1] Iterasi 1
[00:01:56][worker1] Mengirim pesan [1] ke PubSub
[00:02:03][worker2] Iterasi 1
[00:02:03][worker2] Mengirim pesan [1] ke PubSub
[00:02:03] Tick!
[00:02:03][worker1] Iterasi 2
[00:02:03][worker1] Mengirim pesan [2] ke PubSub
[00:02:10][worker2] Iterasi 2
[00:02:10][worker2] Mengirim pesan [2] ke PubSub
[00:02:10] Tick!
[00:02:10][worker1] Iterasi 3
[00:02:10][worker1] Mengirim pesan [3] ke PubSub
[00:02:44][worker2] Iterasi 3
[00:02:44][worker2] Mengirim pesan [3] ke PubSub
[00:02:44] Tick!
[00:02:44][worker1] Iterasi 4
[00:02:44][worker1] Mengirim pesan [4] ke PubSub
[00:03:18][worker2] Iterasi 4
[00:03:18][worker2] Mengirim pesan [4] ke PubSub
[00:03:18] Tick!
[00:03:18][worker1] Iterasi 5
[00:03:18][worker1] Mengirim pesan [5] ke PubSub
[00:03:52][worker2] Iterasi 5
[00:03:52][worker2] Mengirim pesan [5] ke PubSub
[00:03:52] Tick!
```

Terlihat bahwa jeda pada salah satu bagian dari operasi *asynchronous* menyebabkan kode program di `setInterval` tidak lagi dijalankan 
setiap detik sebagaimana seharusnya.  Baik `worker1` dan `worker2` mengalami jeda yang cukup lama, walaupun sebenarnya yang sibuk 
hanya `worker1`.  Ini adalah salah satu alasan mengapa selalu dokumentasi Node.js menyarankan untuk selalu berusaha membuat kode program *asynchronous* 
yang kecil dan singkat.  Semakin lama dan semakin kompleks sebuah `Promise` atau *timer*, semakin besar kemungkinan operasi tersebut akan 
mem-blokir *event loop*.  Saya bisa menggunakan [Clinic.js](https://clinicjs.org/) untuk memeriksa kesehatan *event loop*, dengan memberikan
perintah `clinic doctor`.  Untuk kode program di atas, saya akan mendapatkan hasil seperti berikut ini:

![Hasil Clinic.js Untuk Event Loop Terblokir]({{ "/assets/images/gambar_00049.png" | relative_url}}){:class="img-fluid rounded"}

Pada grafis yang dihasilkan perintah `clinic doctor` di atas, terlihat bahwa *event loop* terjeda sampai lebih dari 30 detik.  Ini adalah jeda 
yang sangat tinggi, bila dibandingkan dengan versi awal (normal) seperti yang terlihat pada gambar berikut ini:

![Hasil Clinic.js Untuk Event Loop Normal]({{ "/assets/images/gambar_00050.png" | relative_url}}){:class="img-fluid rounded"}

Pada grafis di atas, jeda paling tinggi untuk *event loop* hanya sekitar 0.4 milidetik.

Untuk menghindari *event loop* yang terblokir, saya bisa mem-partisi kode program yang lambat menjadi beberapa bagian kecil dan menggunakan 
`setImmediate()` untuk memberikan kesempatan agar operasi lain di *event loop* dikerjakan terlebih dahulu.  Sebagai contoh, saya akan 
mengubah kode program Node.js saya menjadi seperti berikut ini:

```typescript
import {EventEmitter} from 'events';

async function publishEvent(workerId: string, iterationNumber: number) {
    console.log(`[${new Date().toLocaleString()}][${workerId}] Mengirim pesan [${iterationNumber}] ke PubSub`);
}

function start(workerId: string) {
    let iterationNumber = 0;
    setInterval(async () => {
        iterationNumber++;
        console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber}`);
        await publishEvent(workerId, iterationNumber);
        if (workerId === 'worker1') {
            setImmediate(() => {
                for (let a = 0; a < 2499999999; a++) ;
                console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber} Bagian #1 dari long-running selesai!`);
                setImmediate(() => {
                    for (let a = 2499999999; a < 4999999999; a++) ;
                    console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber} Bagian #2 dari long-running selesai!`);
                    setImmediate(() => {
                        for (let a = 4999999999; a < 7499999999; a++) ;
                        console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber} Bagian #3 dari long-running selesai!`);
                        setImmediate(() => {
                            for (let a = 7499999999; a < 9999999999; a++) ;
                            console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber} Bagian #4 dari long-running selesai!`);
                        })
                    });
                })
            });
        }
    }, 1000);
}

async function main() {
    const emitter = new EventEmitter();
    emitter.on('start', async workerId => {
        start(workerId);
    });
    emitter.emit('start', 'worker1');
    emitter.emit('start', 'worker2');

}

main().then(() => 'Mulai').catch(err => console.error(err));

setInterval(() => console.log(`[${new Date().toLocaleString()}] Tick!`), 1000);
```

Bila kode program di atas dijalankan, hasilnya akan terlihat seperti:

```
[00:56:28][worker1] Iterasi 1
[00:56:28][worker1] Mengirim pesan [1] ke PubSub
[00:56:28][worker2] Iterasi 1
[00:56:28][worker2] Mengirim pesan [1] ke PubSub
[00:56:28] Tick!
[00:56:29][worker1] Iterasi 1 Bagian #1 dari long-running selesai!
[00:56:29][worker1] Iterasi 2
[00:56:29][worker1] Mengirim pesan [2] ke PubSub
[00:56:29][worker2] Iterasi 2
[00:56:29][worker2] Mengirim pesan [2] ke PubSub
[00:56:29] Tick!
[00:56:31][worker1] Iterasi 2 Bagian #2 dari long-running selesai!
[00:56:33][worker1] Iterasi 2 Bagian #1 dari long-running selesai!
[00:56:33][worker1] Iterasi 3
[00:56:33][worker1] Mengirim pesan [3] ke PubSub
[00:56:33][worker2] Iterasi 3
[00:56:33][worker2] Mengirim pesan [3] ke PubSub
[00:56:33] Tick!
[00:56:35][worker1] Iterasi 3 Bagian #3 dari long-running selesai!
[00:56:37][worker1] Iterasi 3 Bagian #2 dari long-running selesai!
[00:56:37][worker1] Iterasi 3 Bagian #1 dari long-running selesai!
[00:56:37][worker1] Iterasi 4
[00:56:37][worker1] Mengirim pesan [4] ke PubSub
[00:56:37][worker2] Iterasi 4
[00:56:37][worker2] Mengirim pesan [4] ke PubSub
[00:56:37] Tick!
[00:56:39][worker1] Iterasi 4 Bagian #4 dari long-running selesai!
[00:56:41][worker1] Iterasi 4 Bagian #3 dari long-running selesai!
[00:56:50][worker1] Iterasi 4 Bagian #2 dari long-running selesai!
[00:56:51][worker1] Iterasi 4 Bagian #1 dari long-running selesai!
[00:56:51][worker1] Iterasi 5
[00:56:51][worker1] Mengirim pesan [5] ke PubSub
[00:56:51][worker2] Iterasi 5
[00:56:51][worker2] Mengirim pesan [5] ke PubSub
[00:56:51] Tick!
[00:56:53][worker1] Iterasi 5 Bagian #4 dari long-running selesai!
[00:57:02][worker1] Iterasi 5 Bagian #3 dari long-running selesai!
[00:57:10][worker1] Iterasi 5 Bagian #2 dari long-running selesai!
[00:57:11][worker1] Iterasi 5 Bagian #1 dari long-running selesai!
[00:57:11][worker1] Iterasi 6
[00:57:11][worker1] Mengirim pesan [6] ke PubSub
[00:57:11][worker2] Iterasi 6
[00:57:11][worker2] Mengirim pesan [6] ke PubSub
[00:57:11] Tick!
```

Kali ini `worker1` dan `worker2` terlihat lebih responsif.  Walaupun demikian, mereka tetap tidak dikerjakan secara teratur 
setiap detik.  Selain itu, semakin banyak iterasi jangka panjang yang tertunda hanya akan membuat mereka semakin lama seiring waktu
berlalu.  Tanpa *multi-threading* yang bisa menjalankan beberapa kode program secara paralel dan bersamaan, ini adalah hasil paling
maksimum yang bisa saya capai.

Pada contoh di atas, dampak dari ter-blokir-nya *event loop* terasa sangat jelas.  Akan tetapi pada kondisi tertentu, saya bisa saja
menjumpai kasus aneh yang tidak saya duga penyebabnya adalah *event loop*.  Sebagai contoh, library PubSub untuk Node.js secara bawaan 
akan mengaktifkan *batching*.  Saya akan mengubah function `publishEvent()` di kode program saya untuk mengirim ke PubSub 
paling lambat 100 milidetik setelah permintaan pengiriman diterima, seperti pada contoh berikut ini:

```typescript
const pubsub = new PubSub();
const topic = pubsub.topic('test', {
    batching: {
        maxMessages: 10,
        maxMilliseconds: 100,
    }
});

async function publishEvent(workerId: string, iterationNumber: number) {
    console.log(`[${new Date().toLocaleString()}][${workerId}] Mengirim pesan [${iterationNumber}] ke PubSub`);
    await topic.publish(Buffer.from(JSON.stringify({workerId, iterationNumber})));
    console.log(`[${new Date().toLocaleString()}][${workerId}] Pesan berhasil dikirim ke PubSub`);
}
```

Terlihat sederhana, bukan?  Saya ingin pesan dikirim ke PubSub secepat mungkin tanpa jeda, sepertinya batas waktu 100 milidetik 
seharusnya tidak masalah, bukan?  Ternyata tidak sesederhana itu! Saat *event loop* terlalu sibuk, saya akan memperoleh hasil 
seperti pada berikut ini:

```
[00:51:07][worker1] Iterasi 1
[00:51:07][worker1] Mengirim pesan [1] ke PubSub
[00:51:07][worker2] Iterasi 1
[00:51:07][worker2] Mengirim pesan [1] ke PubSub
[00:51:07] Tick!
[00:51:08][worker1] Pesan berhasil dikirim ke PubSub
[00:51:08][worker2] Pesan berhasil dikirim ke PubSub
[00:51:10][worker1] Iterasi 1 Bagian #1 dari long-running selesai!
[00:51:10][worker1] Iterasi 2
[00:51:10][worker1] Mengirim pesan [2] ke PubSub
[00:51:10][worker2] Iterasi 2
[00:51:10][worker2] Mengirim pesan [2] ke PubSub
[00:51:10] Tick!
[00:51:11][worker1] Iterasi 2 Bagian #2 dari long-running selesai!
[00:51:11][worker1] Iterasi 3
[00:51:11][worker1] Mengirim pesan [3] ke PubSub
[00:51:11][worker2] Iterasi 3
[00:51:11][worker2] Mengirim pesan [3] ke PubSub
[00:51:11] Tick!
[00:51:13][worker1] Iterasi 3 Bagian #3 dari long-running selesai!
[00:51:13][worker1] Iterasi 4
[00:51:13][worker1] Mengirim pesan [4] ke PubSub
[00:51:13][worker2] Iterasi 4
[00:51:13][worker2] Mengirim pesan [4] ke PubSub
[00:51:13] Tick!
[00:51:15][worker1] Iterasi 4 Bagian #4 dari long-running selesai!
[00:51:15][worker1] Pesan berhasil dikirim ke PubSub
[00:51:15][worker2] Pesan berhasil dikirim ke PubSub
[00:51:15][worker1] Iterasi 5
[00:51:15][worker1] Mengirim pesan [5] ke PubSub
[00:51:15][worker2] Iterasi 5
[00:51:15][worker2] Mengirim pesan [5] ke PubSub
[00:51:15] Tick!
[00:51:17][worker1] Iterasi 5 Bagian #1 dari long-running selesai!
[00:51:17][worker1] Pesan berhasil dikirim ke PubSub
[00:51:17][worker2] Pesan berhasil dikirim ke PubSub
```

Pada hasil eksekusi di atas, terlihat dengan jelas terdapat jarak yang jauh antara baris *"Mengirim pesan ke PubSub"* dan 
*"Pesan berhasil dikirim ke PubSub"*.  Rentang waktu yang ada mencapai 6 detik.  Mengapa demikian? Bukankah tidak ada proses 
yang berat di function `publishEvent()`?  Hanya satu baris untuk mengirim pesan ke PubSub!  Perlu diingat bahwa library PubSub tidak
mengirim pesan secara *synchronous*, melainkan *asynchronous* melalui `MessageQueue` yang mengimplementasikan `EventEmitter`.  Dengan
demikian, bila *event loop* terblokir, maka proses pengiriman pesan ke PubSub juga terkena dampaknya.  *Batching* yang seharusnya hanya 
perlu menunggu 100 milidetik, menjadi harus menunggu hingga operasi yang mem-blokir *event loop* selesai dikerjakan.

Solusi lain untuk mengatasi pemblokiran *event loop* adalah dengan menggunakan [worker thread](https://nodejs.org/docs/latest-v12.x/api/worker_threads.html).
*Thread*? Iya, benar, Node.js 10.5.0 ke atas sudah dilengkapi dengan kemampuan membuat *thread* baru yang disebut sebagai *worker thread*.  Sebagai contoh, 
saya akan mengubah kode program Node.js saya menjadi seperti berikut ini:

```typescript
import {EventEmitter} from 'events';
import {PubSub} from '@google-cloud/pubsub';
import {isMainThread, Worker, workerData, parentPort} from 'worker_threads';

const pubsub = new PubSub();
const topic = pubsub.topic('test', {
    batching: {
        maxMessages: 10,
        maxMilliseconds: 100,
    }
});

async function publishEvent(workerId: string, iterationNumber: number) {
    console.log(`[${new Date().toLocaleString()}][${workerId}] Mengirim pesan [${iterationNumber}] ke PubSub`);
    await topic.publish(Buffer.from(JSON.stringify({workerId, iterationNumber})));
    console.log(`[${new Date().toLocaleString()}][${workerId}] Pesan berhasil dikirim ke PubSub`);
}

function start(workerId: string) {
    let iterationNumber = 0;
    setInterval(async () => {
        iterationNumber++;
        console.log(`[${new Date().toLocaleString()}][${workerId}] Iterasi ${iterationNumber}`);
        await publishEvent(workerId, iterationNumber);
        if (workerId === 'worker1') {
            const worker = new Worker(__filename, {workerData: {workerId, iterationNumber}});
            worker.on('message', (hasil) => {
                console.log(`[${new Date().toLocaleString()}][${workerId}] Hasil [${iterationNumber}] adalah ${hasil}`);
            });
        }
    }, 1000);
}

async function main() {
    const emitter = new EventEmitter();
    emitter.on('start', async workerId => {
        start(workerId);
    });
    emitter.emit('start', 'worker1');
    emitter.emit('start', 'worker2');

}

if (isMainThread) {
    main().then(() => 'Mulai').catch(err => console.error(err));
    setInterval(() => console.log(`[${new Date().toLocaleString()}] Tick!`), 1000);
} else {
    console.log(`[${new Date().toLocaleString()}][${workerData.workerId}] Iterasi ${workerData.iterationNumber} Proses lambat dimulai!`);
    let i = 0;
    for (; i < 9999999999; i++);
    console.log(`[${new Date().toLocaleString()}][${workerData.workerId}] Iterasi ${workerData.iterationNumber} Proses lambat selesai!`);
    parentPort.postMessage(i);
}
```

Hasil eksekusinya akan terlihat seperti:

```
[00:41:37][worker1] Iterasi 1
[00:41:37][worker1] Mengirim pesan [1] ke PubSub
[00:41:37][worker2] Iterasi 1
[00:41:37][worker2] Mengirim pesan [1] ke PubSub
[00:41:37] Tick!
[00:41:37][worker1] Pesan berhasil dikirim ke PubSub
[00:41:37][worker2] Pesan berhasil dikirim ke PubSub
[00:41:37][worker1] Iterasi 1 Proses lambat dimulai!
[00:41:38][worker1] Iterasi 2
[00:41:38][worker1] Mengirim pesan [2] ke PubSub
[00:41:38][worker2] Iterasi 2
[00:41:38][worker2] Mengirim pesan [2] ke PubSub
[00:41:38] Tick!
[00:41:38][worker1] Pesan berhasil dikirim ke PubSub
[00:41:38][worker2] Pesan berhasil dikirim ke PubSub
[00:41:38][worker1] Iterasi 2 Proses lambat dimulai!
[00:41:39][worker1] Iterasi 3
[00:41:39][worker1] Mengirim pesan [3] ke PubSub
[00:41:39][worker2] Iterasi 3
[00:41:39][worker2] Mengirim pesan [3] ke PubSub
[00:41:39] Tick!
[00:41:39][worker1] Pesan berhasil dikirim ke PubSub
[00:41:39][worker2] Pesan berhasil dikirim ke PubSub
[00:41:39][worker1] Iterasi 3 Proses lambat dimulai!
[00:41:40][worker1] Iterasi 4
[00:41:40][worker1] Mengirim pesan [4] ke PubSub
[00:41:40][worker2] Iterasi 4
[00:41:40][worker2] Mengirim pesan [4] ke PubSub
[00:41:40] Tick!
[00:41:40][worker1] Pesan berhasil dikirim ke PubSub
[00:41:40][worker2] Pesan berhasil dikirim ke PubSub
[00:41:40][worker1] Iterasi 4 Proses lambat dimulai!
[00:41:41][worker1] Iterasi 5
[00:41:41][worker1] Mengirim pesan [5] ke PubSub
[00:41:41][worker2] Iterasi 5
[00:41:41][worker2] Mengirim pesan [5] ke PubSub
[00:41:41] Tick!
[00:41:41][worker1] Pesan berhasil dikirim ke PubSub
[00:41:41][worker2] Pesan berhasil dikirim ke PubSub
[00:41:41][worker1] Iterasi 5 Proses lambat dimulai!
[00:41:42][worker1] Iterasi 6
[00:41:42][worker1] Mengirim pesan [6] ke PubSub
[00:41:42][worker2] Iterasi 6
[00:41:42][worker2] Mengirim pesan [6] ke PubSub
[00:41:42] Tick!
[00:41:42][worker1] Pesan berhasil dikirim ke PubSub
[00:41:42][worker2] Pesan berhasil dikirim ke PubSub
[00:41:42][worker1] Iterasi 6 Proses lambat dimulai!
[00:41:43][worker1] Iterasi 7
[00:41:43][worker1] Mengirim pesan [7] ke PubSub
[00:41:43][worker2] Iterasi 7
[00:41:43][worker2] Mengirim pesan [7] ke PubSub
[00:41:43] Tick!
[00:41:43][worker1] Pesan berhasil dikirim ke PubSub
[00:41:43][worker2] Pesan berhasil dikirim ke PubSub
[00:41:43][worker1] Iterasi 7 Proses lambat dimulai!
[00:41:44][worker1] Iterasi 8
[00:41:44][worker1] Mengirim pesan [8] ke PubSub
[00:41:44][worker2] Iterasi 8
[00:41:44][worker2] Mengirim pesan [8] ke PubSub
[00:41:44] Tick!
[00:41:44][worker1] Pesan berhasil dikirim ke PubSub
[00:41:44][worker2] Pesan berhasil dikirim ke PubSub
[00:41:44][worker1] Iterasi 8 Proses lambat dimulai!
[00:41:44][worker1] Hasil [1] adalah 9999999999
[00:41:44][worker1] Iterasi 1 Proses lambat selesai!
[00:41:45][worker1] Iterasi 9
[00:41:45][worker1] Mengirim pesan [9] ke PubSub
[00:41:45][worker2] Iterasi 9
[00:41:45][worker2] Mengirim pesan [9] ke PubSub
[00:41:45] Tick!
[00:41:45][worker1] Pesan berhasil dikirim ke PubSub
[00:41:45][worker2] Pesan berhasil dikirim ke PubSub
[00:41:45][worker1] Iterasi 9 Proses lambat dimulai!
[00:41:45][worker1] Hasil [2] adalah 9999999999
[00:41:45][worker1] Iterasi 2 Proses lambat selesai!
[00:41:46][worker1] Iterasi 10
[00:41:46][worker1] Mengirim pesan [10] ke PubSub
[00:41:46][worker2] Iterasi 10
[00:41:46][worker2] Mengirim pesan [10] ke PubSub
[00:41:46] Tick!
[00:41:46][worker1] Pesan berhasil dikirim ke PubSub
[00:41:46][worker2] Pesan berhasil dikirim ke PubSub
[00:41:46][worker1] Iterasi 10 Proses lambat dimulai!
[00:41:46][worker1] Hasil [3] adalah 9999999999
[00:41:46][worker1] Iterasi 3 Proses lambat selesai!
```

Kali ini `worker1` dan `worker2` bekerja hampir setiap detik.  Juga tidak ada masalah keterlambatan lagi dalam pengiriman 
pesan ke PubSub.  Yang berbeda adalah operasi lambat di `worker1` kini tidak lagi mem-blokir eksekusi dan sudah sepenuhnya 
*asynchronous*.  Sebagai contoh, hasil perhitungan untuk iterasi pertama baru muncul 6 detik setelah operasi untuk iterasi 
 tersebut selesai dikerjakan.
 
Walaupun *worker thread* membuat *thread* baru, pengalaman memakainya memiliki rasa yang sangat berbeda dari model pemograman *multi-threaded* 
di bahasa seperti Java.  Saya juga tetap harus berhati-hati agar tidak memblokir *event loop* di Node.js walaupun sudah ada *worker thread*. 
Oleh sebab itu, secara garis besar, Node.js tetap masuk dalam kategori *single-threaded*.