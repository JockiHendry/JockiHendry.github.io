---
layout: post
category: Pemograman
title: Memakai Stream Di Node.js
tags: [Node]
---

Untuk membaca sebuah file, saya dapat menggunakan modul fasilitas yang ditawarkan oleh `fs` seperti `readFile()` untuk versi *asynchronous* atau `readFileSync()` untuk versi *synchronous*.  Kedua *functions* tersebut akan membaca seluruh isi file dan menyimpannya ke memori (RAM) sebagai `Buffer`.  Namun, sama seperti proses lainnya di sistem operasi, aplikasi Node.js juga memiliki batasan alokasi memori.  Sebagai contoh, pada sistem saya, ukuran `Buffer` maksimum adalah 2 GB.  Bila saya membaca file lebih besar dari 2 GB dengan `readFile()` atau `readFileSync()`, saya akan memperoleh pesan kesalahan seperti `Range Error [ERR_FS_FILE_TOO_LARGE]: File size is greater than 2 GB`.  Apa yang harus saya lakukan bila tetap ingin memproses file tersebut?  Saya bisa menggunakan [Stream](https://nodejs.org/api/stream.html) yang akan memproses file dalam bentuk potongan-potongan kecil.  Secara garis besar, walaupun lebih rumit, *stream* akan lebih efisien terutama dalam memproses file besar.

Node.js mendukung dua jenis implementasi *stream*: [Stream](https://nodejs.org/api/stream.html) dan [Web Streams API](https://nodejs.org/api/webstreams.html).  Saat ini status dukungan Web Streams API masih *experimental*.  Web Streams adalah API yang sama seperti yang dipakai oleh programmer *front-end* di *browser*.  Walaupun demkian, sama seperti di Node.js, Web Streams juga sepertinya belum didukung sempurna di semua *browser*.  Berdasarkan <https://caniuse.com/streams>, hanya Chrome dan Edge terbaru yang mengimplementasikannya, sementara Firefox masih belum sepenuhnya mendukung spesifikasi tersebut.  Oleh sebab itu, pada artikel ini, saya akan fokus pada *stream* API yang stabil (yang merupakan bawaan Node.js).

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> <em>Stream</em> tidak hanya berlaku untuk file, tetapi juga semua yang berhubungan dengan I/O seperti pemograman <em>socket</em> jaringan komputer, HTTP, <em>standard input</em>, <em>standard output</em> dan sebagainya.
</div>

Secara garis besar, Node.js memiliki 4 jenis *stream*: `Writable`, `Readable`, `Duplex` dan `Transform`.  Sesuai dengan namanya, `Writable` dipakai untuk menulis dan `Readable` dipakai untuk membaca. `Duplex` pada dasarnya adalah sebuah `Readable` yang juga `Writable` sehingga mendukung operasi baca tulis.  `Transform` adalah sebuah `Duplex` yang mendukung pemrosesan sehingga apa yang ditulis berbeda dengan apa yang dibaca.

Karena ingin membaca file, saya akan mendapatkan sebuah *instance* `Readable` dari `fs`, seperti pada contoh berikut ini:

```javascript
import * as fs from 'fs';

const result = fs.createReadStream('sebuah_file_sangat_besar.dat');
let size = 0;
result.on('data', (chunk) => {
    // Proses file disini
    size += Buffer.byteLength(chunk);
});
result.on('end', () => {
    console.log(`Berhasil memproses ${(size/Math.pow(1024,3)).toFixed(2)} GB data`);
});
```

Salah fitur yang sangat berguna dalam menyederhakan kode program adalah fasilitas `pipe()` di *stream*.  Dengan `pipe()`, saya bisa menggabungkan dua atau lebih file.  Sebagai contoh, kode program berikut ini akan menyalin file dengan menggunakan *stream*:

```javascript
import * as fs from 'fs';
import {pipeline} from 'stream';

const source = fs.createReadStream('sebuah_file_sangat_besar.dat');
const target = fs.createWriteStream('duplikasi.dat');

pipeline(source, target, (err) => {
    if (err) {
        console.log('Terjadi kesalahan', err);
    } else {
        console.log('File berhasil disalin!');
    }
});
```

Kode program di atas sama seperti `source.pipe(target)` yang akan mengirim `source` *stream* ke `target` *stream*.  Penggunaan `pipeline()` memungkinkan saya mendaftarkan *callback* yang berperan sebagai *error handler* di setiap *stream* yang terlibat (sehingga tidak perlu mendaftarkan satu per satu dengan kode seperti `stream.on('error', cb)`).

Pada kode program di atas, bagaimana bila saya ingin menampilkan indikator selama proses penyalinan berlangsung?  Saya dapat menggunakan sebuah turunan `Transform` yang disebut sebagai `PassThrough`.  Ini mirip seperti `tap()` di RxJS: ia tetap akan melewatkan *stream* asal ke *stream* tujuan apa adanya, tapi juga memungkinkan saya untuk menambahkan sebuah proses yang tidak melakukan transformasi seperti melakukan *logging*.  Sebagai contoh, saya mengubah kode program menjadi seperti berikut ini:

```javascript
import * as fs from 'fs';
import {pipeline, PassThrough, Transform} from 'stream';

const source = fs.createReadStream('sebuah_file_sangat_besar.dat');
const target = fs.createWriteStream('duplikasi.dat');

class CounterStream extends Transform {

    _size = 0;
    _chunk;

    _transform(chunk, encoding, callback) {
        this._chunk = chunk;
        this._size += Buffer.byteLength(chunk);
        this.push(`\x1Bc ${(this._size / Math.pow(1024, 3)).toFixed(2)} GB`);
        callback();
    }

    _flush(callback) {
        this.push(`\x1Bc ${(this._size / Math.pow(1024, 3)).toFixed(2)} GB`);
        callback();
    }
}

const passThrough = new PassThrough();

pipeline(source, passThrough, target, (err) => {
    if (err) {
        console.log('Terjadi kesalahan', err);
    } else {
        console.log('File berhasil disalin!');
    }
});

pipeline(passThrough, new CounterStream(), process.stdout, (err) => {
    if (err) {
        console.log('Terjadi kesalahan', err);
    }
});
```

Pada kode program di atas, *stream*-nya terlihat seperti pada diagram berikut ini:

<div class="diagram">
source ──► passThrough ──┬───► target
                         │
                         └───► counterStream ──► process.stdout
</div>

Sebuah *stream* boleh saja memiliki lebih dari satu `pipe()`.  Ini disebut juga sebagai *forking stream*.  Pada contoh di atas, keluaran dari *stream* `passThrough` akan diarahkan ke `target` (file yang salin) dan juga ke sebuah `Transform` *stream* bernama `CounterStream` yang akan mengembalikan ukuran yang sudah diproses dalam satuan GB.  Hasil dari `CounterStream` ini kemudian diarahkan ke `process.stdout` yang merupakan sebuah *stream* yang dipakai untuk menulis ke layar (yang biasanya dilakukan melalui `console.log()`).

Bagaimana bila proses yang dilakukan untuk sebuah potongan file oleh *stream* sangat lambat?  Atau, kondisi dimana `Readable` bekerja sangat cepat, mengirim banyak data ke `Writable` yang lambat dalam mengkonsumsinya?  `Writable` tersebut tetap akan menyimpan data yang masuk secara sementara.  Apa yang terjadi bila data sementara yang belum diproses oleh `Writable` semakin menumpuk?  Memori akan menjadi penuh dan kesalahan seperti saat memakai `readFile()` atau `writeFile()` akan timbul kembali!  Oleh sebab itu, *stream* hanya akan menampung data sementara sebanyak nilai yang ditentukan oleh `highWaterMark`.  Nilai ini *default*-nya adalah 16 kb dan dapat diatur pada saat *stream* dibuat.  Setelah `highWaterMark` tercapai, *stream* harus berhenti bekerja dan menunggu hingga apa yang tertunda selesai dikerjakan.  Proses ini disebut sebagai *backpressure*.  *Stream* bawaan Node.js sudah mendukung *backpressure* akan tetapi saat membuat *stream* sendiri, pembuat *stream* bertanggung jawab untuk memastikan *stream*-nya mendukung *backpressure*.

Untuk contoh yang lebih realistis, saya akan membuat kode program yang membaca daftar alamat IP dari file CSV (kolom ketiga dan kolom kelima) dan menghasilkan file yang berisi daftar *hostname* yang unik dari file tersebut.  File sumber saya sudah dikompres dalam format `gzip` sehingga program perlu melakukan `gunzip` terlebih dahulu.  Kode programnya terlihat seperti berikut ini:

```javascript
import {createWriteStream, createReadStream} from 'fs';
import {createGunzip} from 'zlib';
import {isIPv4} from 'net';
import {setServers, reverse} from 'dns/promises';
import {pipeline, Transform} from 'stream';


const source = createReadStream('data.gz');
const target = createWriteStream('output.txt');
const gunzip = createGunzip();

class ExtractIPAddress extends Transform {

    constructor() {
        super({objectMode: true, highWaterMark: 100});
    }

    _transform(chunk, encoding, callback) {
        for (const line of chunk.toString().split('\n')) {
            if (line.startsWith('#')) {
                continue;
            }
            const fields = line.split(',');
            if (isIPv4(fields[2])) {
                this.push(fields[2]);
            }
            if (isIPv4(fields[4])) {
                this.push(fields[4]);
            }
        }
        callback();
    }

}

class Distinct extends Transform {

    values = new Set();

    constructor() {
        super({objectMode: true, highWaterMark: 100});
    }

    _transform(value, encoding, callback) {
        if (!this.values.has(value)) {
            this.values.add(value);
            this.push(`${value}\n`);
        }
        callback();
    }

}

class ResolveDNS extends Transform {

    failed = 0;

    constructor() {
        super({objectMode: true, highWaterMark: 3});
        setServers(['1.1.1.1', '8.8.8.8']);
    }

    async _transform(ipAddress, encoding, callback) {
        ipAddress = ipAddress.trim();
        let success = true;
        try {
            const hostnames = await reverse(ipAddress);
            this.push(hostnames.join(',') + '\n');
            success = true;
        } catch (e) {
            this.failed++;
            success = false;
        } finally {
            console.log(`Mencari nama host untuk ip ${ipAddress}: ${success ? 'sukses' : 'gagal'}`);
            callback();
        }
    }

    _flush(callback) {
        console.log(`Jumlah query gagal: ${this.failed}`);
    }

}

pipeline(source, gunzip, new ExtractIPAddress(), new Distinct(), new ResolveDNS(), target, (err) => {
    if (err) {
        console.log(`Terjadi kesalahan`, err);
    } else {
        console.log(`Proses selesa!`);
    }
});
```

Pipeline *stream* yang berlangsung akan terlihat seperti berikut ini:

<div class="diagram">
source ──► gunzip ──► extractIPAddress ──► distinct ──► resolveDNS ──► output                
</div>

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Satu hal yang menarik disini adalah saya tidak menggunakan <em>package</em> eksternal dari npm sama sekali.  Node.js menyediakan <em>library</em> bawaan yang sangat lengkap, misalnya <code>dns</code> untuk melakukan <em>query</em> ke DNS server, <code>net.isIPv4()</code> untuk mendeteksi apakah string adalah IPv4 yang valid, dan <code>zlib.createGunzip()</code> untuk membuat <em>stream</em> <code>Transform</code> yang dapat membaca file gzip.  Memakai library bawaan tentu saja lebih stabil dan lebih aman dibandingkan harus meng-<em>install</em> library pihak ketiga dari npm.
</div>

`source` adalah sebuah `Readable` yang dibuat dengan menggunakan `fs.createReadStream()`.  Ini adalah bawaan Node.js.

`gunzip` adalah sebuah `Transform` *stream* yang melakukan transformasi dari file gzip ke versi yang sudah di-ekstrak.  Ini adalah bawaan Node.js.

`ExtractIpAddress` adalah sebuah `Transform` *stream* buatan sendiri.  *Stream* ini menerima satu atau lebih baris CSV (yang dipisahkan dengan tanda koma).  Transformasi *stream* tidak harus selalu satu masukan ke satu keluaran (*one to one*).  Sebagai contoh, pada *stream* ini, untuk setiap baris CSV akan ada dua keluaran: nilai kolom ketiga dan nilai kolom kelima.  Ini terlihat dari `this.push()` yang dikerjakan dua kali untuk setiap baris.

`Distinct` adalah sebuah `Transform` *stream* buatan sendiri.  *Stream* ini hanya akan menulis keluaran bila sebelumnya belum pernah ada sehingga nilai keluarannya tidak mengandung duplikat.  Pada *stream* ini, terlihat bahwa satu masukan bahkan boleh tidak memiliki keluaran sama sekali.  Sebagai contoh, bila nilai sudah ada, saya tidak memanggil `this.push()` dan langsung memanggil `callback` sehingga proses akan lanjut ke nilai masukan berikutnya.

`ResolveDNS` adalah sebuah `Transform` *stream* buatan sendiri.  *Stream* ini  akan menerjemahkan masukan berupa alamat IP menjadi sebuah nama yang dicari melalui `dns.reverse()`.  Karena *stream* ini akan menggunakan jaringan untuk mengakses DNS server, boleh dibilang *stream* ini adalah yang paling lambat dan menjadi *bottleneck*.

`output` adalah sebuah `Writable` yang dibuat dengan menggunakan `fs.createWriteStream()`.  Ini adalah bawaan Node.js.

Pada setiap *stream* buatan sendiri, saya memberikan nilai `true` untuk `objectMode` di *constructor*.  Salah satu dampaknya adalah nilai `highWaterMark` kini bukan lagi merujuk pada ukuran melainkan jumlah elemen.  Sebagai contoh, nilai `100` pada `highWaterMark` berarti *buffer* untuk 100 elemen, bukan *buffer* sebesar 100 KB.  Selain itu, karena tipe *stream* buatan sendiri ini adalah `Transform`, saya tidak perlu menangani *backpressure*.  Bila ini adalah `Readable` atau `Writable`, saya perlu memastikan bahwa bila `this.push()` mengembalikan nilai `false`, *stream* harus berhenti hingga event `drain` muncul.

Saat kode program di atas dijalankan, ia akan menghasilkan file `output.txt`.  Salah satu karakteristik penggunaan *stream* adalah saat program masih berjalan, saya bisa melihat *hostname* yang berhasil di-*resolve* di `output.txt` dengan `tail -f output.txt` tanpa harus menunggu seluruh alamat IP selesai diproses.