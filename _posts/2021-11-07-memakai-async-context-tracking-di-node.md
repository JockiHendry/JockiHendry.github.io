---
layout: post
category: Pemograman
title: Memakai Asynchronous Context Tracking Di Node.js
tags: [Node]
---

`AsyncLocalStorage` adalah class bawaan Node (terletak di modul `async_hooks`) yang dapat digunakan untuk memberikan *context* pada eksekusi operasi 
*asynchronous* dan juga semua operasi *asynchronous* yang dipanggil oleh operasi tersebut.  Untuk menunjukkan kondisi dimana `class` ini dapat 
membantu, saya menulis sebuah kode program tanpa *async context* seperti berikut ini:

```typescript
class Room {

    constructor(public roomId: string) {}

    async jalankan(): Promise<void> {
        const webRTC = new WebRTC();
        console.log(`Menyiapkan peserta di room ${this.roomId}`);
        setImmediate(async () => {
            await webRTC.buatSession(this.roomId, 'peserta1');
        });
        await webRTC.buatSession(this.roomId, 'peserta2');
        setImmediate(async () => {
            await webRTC.buatSession(this.roomId, 'peserta3');
        })
    }

}

class Helper {

    constructor() {}

    async buatStream(roomId: string, peserta: string): Promise<string> {
        console.log(`Membuat stream untuk peserta ${peserta} di room ${roomId}`);
        return `stream ${peserta}`;
    }

}

class WebRTC {

    constructor() {}

    async buatSession(roomId: string, peserta: string): Promise<string> {
        const helper = new Helper();
        const stream = await helper.buatStream(roomId, peserta);
        await Database.simpan(roomId, peserta);
        return stream;
    }

}

class Database {

    public static storage = new Map<string, string[]>();

    constructor() {}

    static async simpan(roomId: string, peserta: string): Promise<void> {
        console.log(`Menyimpan ${peserta} untuk room ${roomId}`);
        if (this.storage.has(roomId)) {
            this.storage.get(roomId).push(peserta);
        } else {
            this.storage.set(roomId, [peserta]);
        }
    }

}

async function main() {
    const room1 = new Room('room1');
    await room1.jalankan();
    const room2 = new Room('room2');
    await room2.jalankan();
    setTimeout(() => {
        console.log(Database.storage);
    }, 0);

}

main();
```

Kode program di atas mewakili kode program Node.js modern pada umumnya dimana penggunakan `Promise`, `async` dan `await` dapat dijumpai diberbagai tempat.  Pada contoh di atas, method `Room.jalankan()` adalah sebuah *asynchronous function*, yang kemudian memanggil *asynchronous function* lainnya: `WebRTC.buatSession()`.  *Asynchronous function* ini selanjutnya akan memanggil *asynchronous function* lainnya lagi: `Database.simpan()`.   Bila kode program di atas dijalankan, saya akan meperoleh hasil seperti:

```
Menyiapkan peserta di room room1
Membuat stream untuk peserta peserta2 di room room1
Menyimpan peserta2 untuk room room1
Menyiapkan peserta di room room2
Membuat stream untuk peserta peserta2 di room room2
Menyimpan peserta2 untuk room room2
Membuat stream untuk peserta peserta1 di room room1
Menyimpan peserta1 untuk room room1
Membuat stream untuk peserta peserta3 di room room1
Menyimpan peserta3 untuk room room1
Membuat stream untuk peserta peserta1 di room room2
Menyimpan peserta1 untuk room room2
Membuat stream untuk peserta peserta3 di room room2
Menyimpan peserta3 untuk room room2
Map(2) {
  'room1' => [ 'peserta2', 'peserta1', 'peserta3' ],
  'room2' => [ 'peserta2', 'peserta1', 'peserta3' ]
}
```

Walaupun kode program di atas berjalan dengan lancar dan benar, ada yang sedikit tidak sedap dipandang di deklarasi method-nya: saya harus selalu menyertakan sebuah variabel `roomId` untuk setiap *asynchronous function* yang dipanggil untuk mengetahui *room* mana yang sedang dikerjakan.  Untuk membuat contoh ini sedikit lebih kompleks, saya akan mengubah class `WebRTC` menjadi sebuah `EventEmitter`.  Class ini juga perlu mengetahui *room* yang sedang dikerjakan sehingga *event* yang di-*emit* juga perlu menyertakan argumen `roomId` seperti pada revisi berikut ini:

```typescript
import {EventEmitter} from 'events';

class Room {

    constructor(public roomId: string) {}

    async jalankan(): Promise<void> {
        const webRTC = new WebRTC();
        console.log(`Menyiapkan peserta di room ${this.roomId}`);
        setImmediate(async () => {
            await webRTC.emit('buat_session', this.roomId, 'peserta1');
        });
        await webRTC.emit('buat_session', this.roomId, 'peserta2');
        setImmediate(async () => {
            await webRTC.emit('buat_session', this.roomId, 'peserta3');
        })
    }

}

class Helper {

    constructor() {}

    async buatStream(roomId: string, peserta: string): Promise<string> {
        console.log(`Membuat stream untuk peserta ${peserta} di room ${roomId}`);
        return `stream ${peserta}`;
    }

}

class WebRTC extends EventEmitter {

    constructor() {
        super({captureRejections: true});
        this.on('buat_session', async (roomId: string, peserta: string) => {
            const helper = new Helper();
            await helper.buatStream(roomId, peserta);
            await Database.simpan(roomId, peserta);
        });
    }

}

class Database {

    public static storage = new Map<string, string[]>();

    constructor() {}

    static async simpan(roomId: string, peserta: string): Promise<void> {
        console.log(`Menyimpan ${peserta} untuk room ${roomId}`);
        if (this.storage.has(roomId)) {
            this.storage.get(roomId).push(peserta);
        } else {
            this.storage.set(roomId, [peserta]);
        }
    }

}

async function main() {
    const room1 = new Room('room1');
    await room1.jalankan();
    const room2 = new Room('room2');
    await room2.jalankan();
    setTimeout(() => {
        console.log(Database.storage);
    }, 100);

}

main();
```

Bagaimana bila saya ingin menghilangkan parameter `roomId` yang kini sudah tersebar dimana-mana? Pada contoh ini, saya hanya menggunakan satu variabel `roomId`, bayangkan bila ada banyak nilai *context* selain `roomId` yang harus dipakai bersama.  Bukankah JavaScript memiliki konsep
variabel global?  Saya akan mencoba mengubah kode program supaya menggunakan sebuah variabel global `roomId` yang dapat dibaca dari mana saja
seperti berikut ini:

```typescript
import {EventEmitter} from 'events';

let roomId: string;

class Room {

    constructor(public roomId: string) {}

    async jalankan(): Promise<void> {
        const webRTC = new WebRTC();
        roomId = this.roomId;
        console.log(`Menyiapkan peserta di room ${this.roomId}`);
        setImmediate(async () => {
            await webRTC.emit('buat_session', 'peserta1');
        });

        await webRTC.emit('buat_session', 'peserta2');
        setImmediate(async () => {
            await webRTC.emit('buat_session', 'peserta3');
        });

    }

}

class WebRTC extends EventEmitter {

    constructor() {
        super({captureRejections: true});
        this.on('buat_session', async (peserta: string) => {
            const helper = new Helper();
            await helper.buatStream(peserta);
            await Database.simpan(peserta);
        });
    }

}

class Helper {

    constructor() {}

    async buatStream(peserta: string): Promise<string> {
        console.log(`Membuat stream untuk peserta ${peserta} di room ${roomId}`);
        return `stream ${peserta}`;
    }

}

class Database {

    public static storage = new Map<string, string[]>();

    constructor() {}

    static async simpan(peserta: string): Promise<void> {
        console.log(`Menyimpan ${peserta} untuk room ${roomId}`);
        if (this.storage.has(roomId)) {
            this.storage.get(roomId).push(peserta);
        } else {
            this.storage.set(roomId, [peserta]);
        }
    }

}

async function main() {
    const room1 = new Room('room1');
    await room1.jalankan();
    const room2 = new Room('room2');
    await room2.jalankan();
    setTimeout(() => {
        console.log(Database.storage);
    }, 100);

}

main();
```

Kode program terlihat jauh lebih rapi dari sebelumnya.  Class `WebRTC` yang sebelumnya membutuhkan informasi `roomId` hanya karena perlu diteruskan 
ke class lain yang dipanggil, kini tidak perlu memiliki ketergantungan tersebut lagi.  Masing-masing *method* yang membutuhkan `roomId` dapat
mengambil nilai tersebut dari variabel global.  Namun, yang jadi masalah adalah kode program di atas **tidak benar**!  Hasilnya **salah** dan tidak sesuai dengan yang diharapkan:

```
Menyiapkan peserta di room room1
Membuat stream untuk peserta peserta2 di room room1
Menyimpan peserta2 untuk room room1
Menyiapkan peserta di room room2
Membuat stream untuk peserta peserta2 di room room2
Menyimpan peserta2 untuk room room2
Membuat stream untuk peserta peserta1 di room room2
Menyimpan peserta1 untuk room room2
Membuat stream untuk peserta peserta3 di room room2
Menyimpan peserta3 untuk room room2
Membuat stream untuk peserta peserta1 di room room2
Menyimpan peserta1 untuk room room2
Membuat stream untuk peserta peserta3 di room room2
Menyimpan peserta3 untuk room room2
Map(2) {
  'room1' => [ 'peserta2' ],
  'room2' => [ 'peserta2', 'peserta1', 'peserta3', 'peserta1', 'peserta3' ]
}
```

Mengapa demikian?  Hampir sama seperti masalah *sharing* data saat menggunakan *thread*, karena `Promise` dikerjakan secara *asynchronous*,
nilai variabel global memiliki peluang besar untuk menjadi tidak konsisten.  Pada contoh di atas, saat `room1` belum selesai dikerjakan, namun `room2` sudah mulai
dikerjakan, nilai `roomId` secara global adalah `room2`.  Tentu saja ini membuat eksekusi `room1` yang belum selesai tersebut melihat nilai
`roomId` berupa `room2` (dimana seharusnya `room1`).

Untuk mengatasi hal ini, saya dapat menggantikan peran variabel global di atas dengan sebuah instance dari `AsyncLocalStorage` seperti yang terlihat 
pada revisi kode program berikut ini:

```typescript
import {EventEmitter} from 'events';
import {AsyncLocalStorage} from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

class Room {

    constructor(public roomId: string) {}

    async jalankan(): Promise<void> {
        await asyncLocalStorage.run(this.roomId, async () => {
            const webRTC = new WebRTC();
            console.log(`Menyiapkan peserta di room ${this.roomId}`);
            setImmediate(async () => {
                await webRTC.emit('buat_session', 'peserta1');
            });
            await webRTC.emit('buat_session', 'peserta2');
            setImmediate(async () => {
                await webRTC.emit('buat_session', 'peserta3');
            });
        });
    }

}

class WebRTC extends EventEmitter {

    constructor() {
        super({captureRejections: true});
        this.on('buat_session', async (peserta: string) => {
            const helper = new Helper();
            await helper.buatStream(peserta);
            await Database.simpan(peserta);
        });
    }

}

class Helper {

    constructor() {}

    async buatStream(peserta: string): Promise<string> {
        const roomId = asyncLocalStorage.getStore() as string;
        console.log(`Membuat stream untuk peserta ${peserta} di room ${roomId}`);
        return `stream ${peserta}`;
    }

}

class Database {

    public static storage = new Map<string, string[]>();

    constructor() {}

    static async simpan(peserta: string): Promise<void> {
        const roomId = asyncLocalStorage.getStore() as string;
        console.log(`Menyimpan ${peserta} untuk room ${roomId}`);
        if (this.storage.has(roomId)) {
            this.storage.get(roomId).push(peserta);
        } else {
            this.storage.set(roomId, [peserta]);
        }
    }

}

async function main() {
    const room1 = new Room('room1');
    await room1.jalankan();
    const room2 = new Room('room2');
    await room2.jalankan();
    setTimeout(() => {
        console.log(Database.storage);
    }, 100);

}

main();
```

Sekarang kode program menghasilkan *output* yang bener dan tetap sederhana dibandingkan dengan versi paling awal!  Walaupun demikian, kode program seharusnya masih bisa terlihat lebih rapi lagi.  Saat ini saya tetap harus menjadikan variabel `asyncLocalStorage` sebagai variabel global yang bisa di-akses bersama karena variabel ini dibutuhkan untuk membaca *context* untuk *asynchronous operation* yang sedang aktif.  Fitur *async context* di Node.js untuk saat ini tidak mendukung fasilitas seperti `Zone.current` di Angular yang bisa mengembalikan `Zone` yang sedang aktif dimana saja tanpa perlu menyimpan referensinya.