---
layout: post
category: Pemograman
title: Membuat Unit Test Yang Melibatkan Waktu
tags: [Node]
---

Pada suatu hari, saya ingin membuat *unit test* untuk menguji kode program yang menggunakan `setInterval()`.  Bagaimana caranya
memastikan bahwa kode program sudah benar melakukan sebuah operasi secara berulang kali, tanpa harus menunggu?  Contoh lain yang
berkaitan dengan waktu adalah menguji kode program yang akan mengirim notifikasi kegagalan bila tidak ada respon yang diterima selama
30 menit. Bagaimana cara memastikan bahwa kode program tersebut telah benar tanpa harus menunggu 30 menit?

Sebagai contoh, kode program yang diuji adalah:

```typescript
import moment, {Moment} from 'moment';
import {PubSub} from '@google-cloud/pubsub';

const pubsub = new PubSub();
const defaultTopic = pubsub.topic('test');

export class Proses {

    mulaiDikerjakan = false;
    selesai = false;

    constructor(private topic = defaultTopic) {}

    mulai(dari: Moment) {
        if (moment().isAfter(dari)) {
            throw new Error('"dari" tidak boleh lampau');
        }
        const jedaMulai = dari.diff(moment(), 'ms', true);
        setTimeout(() => {
            this.mulaiDikerjakan = true;
            let iterasi = 0;
            const intervalId = setInterval(() => {
                iterasi++;
                if (iterasi > 10 ) {
                    clearInterval(intervalId);
                    this.selesai = true;
                    return;
                }
                console.log(`[${new Date().toLocaleString()}][PubSub] Mengirim iterasi ${iterasi}.`);
                this.topic.publish(Buffer.from(JSON.stringify({iterasi}))).then((result) => {
                    console.log(`[${new Date().toLocaleString()}][PubSub] Pesan ${result} berhasil dikirim.`);
                });
            }, 60000);
        }, jedaMulai);
    }

}
```

Kode program di atas akan mengirim pesan ke PubSub selama 10 kali setiap menit sejak waktu yang ditetapkan oleh variabel `dari`.  
Bagaimana caranya supaya saya bisa memastikan kode program di atas berjalan dengan benar?  Eksekusi manual dengan menunggu 
hingga 10 menit untuk melihat apakah terdapat *output* setiap menit akan sangat membosankan.  Memanggil langsung dari *unit test* 
tanpa melakukan *mocking* untuk *timers* sama saja akan menunggu 10 menit.  Salah satu solusi untuk memanipulasi waktu 
(seperti mempercepat *tick*), bila menggunakan Sinon untuk pengujian, adalah dengan menggunakan fasilitas yang ada di 
<https://sinonjs.org/releases/latest/fake-timers/>.

Sebagai langkah pertama, saya akan menguji skenario dimana `dari` tidak boleh di masa lalu sebelum waktu dimana `mulai()` dipanggil.
Bila `dari` di masa lalu, pemanggilan `mulai()` harus men-*throw* `Error`.  Pada latihan ini, saya menggunakan Mocha sebagai 
*testing framework* dan API [assert](https://nodejs.org/api/assert.html) bawaan Node.js untuk *assertion* (sebagai alternatif, 
terdapat juga *library* populer seperti should.js, expect.js, chai, dan sebagainya).  Ini contoh *unit test* yang saya buat:

```javascript
import {Proses} from './Proses';
import moment from 'moment';
import assert from 'assert';
import sinon from 'sinon';

describe('Proses', function() {

    it('harus menolak mulai dari lampau', function() {
        const proses = new Proses();
        const sekarang = moment('2020-12-15T03:00:00.000Z');
        const dari = moment('2020-12-15T02:00:00.000Z');
        sinon.useFakeTimers({
            now: sekarang.valueOf(),
            toFake: ['Date'],
        });
        assert.throws(() => {
            proses.mulai(dari);
        }, Error);
    });

});
```

Pada skenario di atas, saya menggunakan `useFakeTimers` supaya setiap kali terdapat kode program yang mencari waktu saat ini 
seperti `new Date()` dan `moment()` akan mengembalikan waktu yang dirujuk oleh variabel `sekarang`.  Karena `dari` berisi 
waktu lebih awal satu jam dari `sekarang`, maka `proses.mulai(dari)` harus melempar kesalahan `Error`.  Bila tidak, maka 
ada yang salah dengan kode program saya.

Berikutnya, saya akan memastikan bahwa terdapat jeda dimana operasi pengiriman pesan hanya akan dimulai setelah mencapai waktu
 yang ditentukan oleh variabel `dari`.  Selain itu, agar lebih singkat, saya juga memastikan bahwa pesan ke PubSub akan dikirim
   sebanyak 10 kali selama 10 menit.  Hasil akhir dari *unit test* saya terlihat seperti berikut ini:

```javascript
import moment from 'moment';
import sinon from 'sinon';
import {Proses} from './Proses';
import assert from 'assert';
import {PubSub} from '@google-cloud/pubsub';

describe('Proses', function() {

    afterEach(function() {
        sinon.restore();
    });

    it('harus menolak mulai dari lampau', function() {
        const proses = new Proses();
        const sekarang = moment('2020-12-15T03:00:00.000Z');
        const dari = moment('2020-12-15T02:00:00.000Z');
        sinon.useFakeTimers({
            now: sekarang.valueOf(),
            toFake: ['Date'],
        });
        assert.throws(() => {
            proses.mulai(dari);
        }, Error);
    });

    it('harus dikerjakan sesuai jadwal selama jumlah pesan yang ditentukan', function() {
        const sekarang = moment('2020-12-15T03:00:00.000Z');
        const dari = moment('2020-12-15T04:00:00.000Z');
        const clock = sinon.useFakeTimers({ now: sekarang.toDate() });
        const pubsub = new PubSub();
        const topic = pubsub.topic('test');
        const publishStub = sinon.stub(topic, 'publish').resolves('[stub]');
        const proses = new Proses(topic);
        proses.mulai(dari);
        assert.strictEqual(proses.mulaiDikerjakan, false, 'Proses tidak dikerjakan sebelum jam 4');
        clock.tick('30:00');
        assert.strictEqual(proses.mulaiDikerjakan, false, 'Setengah jam sebelum proses dikerjakan');
        clock.tick('30:00');
        assert.strictEqual(proses.mulaiDikerjakan, true, 'Proses baru saja mulai dikerjakan');
        clock.tick('05:00');
        assert.strictEqual(proses.selesai, false, 'Proses belum selesai dikerjakan, baru berjalan 5 menit');
        clock.tick('11:00');
        assert.strictEqual(proses.selesai, true, 'Proses selesai dikerjakan');
        sinon.assert.callCount(publishStub, 10);
    });

});
```

Pada *unit test* di atas,  saya menggunakan `clock.tick()` untuk memajukan waktu secara *synchronous*.  Pada awalnya adalah jam `03:00:00`.
Setelah `clock.tick('00:30:00')`, jam akan berubah menjadi `03:30:00`.  Dengan demikian, saya bisa memajukan waktu secara cepat 
tanpa harus menunggu sama sekali. Dengan membuat *stub* untuk method `publish()` di `Topic`, saya bisa menggunakan `sinon.assert.callCount()` untuk
memastikan *stub* tersebut dipanggil 10 kali.

<div class="alert alert-warning" role="alert">
Walaupun terlihat menarik, jangan menggunakan <code>useFakeTimers()</code> bila tidak perlu!  Ia bisa menyebabkan kesalahan 
yang tidak terduga pada <em>library</em> lain karena merubah perilaku <em>timers</em>.  Kode program yang dirancang dengan 
baik seharusnya dapat diuji tanpa tergantung pada tanggal dan waktu saat ini.  Bila harus bekerja dengan <em>useFakeTimers()</em>, 
usahakan untuk men-<em>stub</em> library lain yang digunakan sebisa mungkin.
</div>
 
Sebagai contoh, saya tidak bisa melakukan pemanggilan aktual ke server PubSub di *unit test* di atas.  Agar lebih mudah mereplikasikannya, saya akan
 merujuk pada contoh kode program tanpa `useFakeTimers()` yang lolos pengujian tanpa masalah:

```javascript
it('sending message', async function() {
    const pubsub = new PubSub();
    const topic = pubsub.topic('test');
    let called = false;
    topic.publishJSON({test: 'test1'}).then(() => {
        called = true;
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.strictEqual(called, true);
});
```

Akan tetapi, begitu saya menambahkan `useFakeTimers()` seperti berikut ini:

```javascript
it('sending message', function() {
    const clock = sinon.useFakeTimers({ now: new Date('2020-12-15T03:00:00.000Z') });
    const pubsub = new PubSub();
    const topic = pubsub.topic('test');
    let called = false;
    topic.publishJSON({test: 'test1'}).then(() => {
        called = true;
    });
    clock.tick('00:00:30');
    assert.strictEqual(called, true);
});
```

Skenario di atas akan berakhir dengan kegagalan.  Setelah `clock.tick()`, pengiriman pesan ke PubSub tidak kunjung selesai juga 
sehingga saya tidak bisa menganggap bahwa seluruh *timers* sudah menjadi *synchronous* (seperti di awal artikel ini).  Terlihat bahwa
dengan melakukan *stubbing* API yang berkaitan dengan waktu, *library* PubSub menjadi tidak berkerja sebagaimana seharusnya.  Tentu saja
tidak akan masalah bisa *library* tersebut ikut di-*stub* juga.