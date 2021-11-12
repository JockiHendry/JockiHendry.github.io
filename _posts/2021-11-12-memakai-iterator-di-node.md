---
layout: post
category: Pemograman
title: Memakai Iterator Dan Generator Di Node.js
tags: [Node]
---

Di JavaScript, tidak ada *class* khusus untuk mewakili *iterator*.  Semua *object* adalah **iterator** bila *object* tersebut memiliki sebuah method dengan nama `next()` yang mengembalikan sebuah *object* yang mengandung `value` dan/atau `done`.  Ini disebut sebagai *iterator protocol*.  Sebuah *object* disebut sebagai **iterable** apabila ia memiliki method dengan nama `@@iterator` (`Symbol.iterator`) yang mengembalikan sebuah *iterator*.  Untuk `next()` yang dikerjakan secara *asynchronous* (seperti `async next()`), saya dapat mengganti `@@iterator` menjadi `@@asyncIterator` (`Symbol.asyncIterator`).  *Object* dari `String`, `Array`, `TypedArray`, `Map` dan `Set` merupakan *iterable*.  Konstruksi `for...of` dan `for await...of` dapat dipakai untuk melakukan iterasi pada *iterable*.

Sebagai contoh, berikut ini adalah *iterable* sekaligus *iterator* yang akan mengembalikan deratan Fibonacci:

```javascript
function fibonacciIterator(n) {
    let n1 = null;
    let n2 = null;
    let step = 0;
    return {
        next() {
            let result;
            if (step >= n) {
                return {done: true};
            }
            if (n1 == null) {
                result = n1 = 0;
            } else if (n2 == null) {
                result = n2 = 1;
            } else {
                result = n1 + n2;
                n1 = n2;
                n2 = result;
            }
            step++;
            return {value: result}
        },
        [Symbol.iterator]() {
            return this;
        }
    }
}
```

Mengapa membuat *object* tersebut *iterable* juga?  Tujuannya adalah supaya saya bisa menggunakan *function* ini di `for...of` seperti:

```javascript
for (const x of fibonacciIterator(10)) {
    console.log(x);
}
// Hasilnya:
// 0
// 1
// 1
// 2
// 3
// dan seterusnya
```

Di JavaScript, struktur data bawaan seperti `Array`, `Map`, `Set`, dan sebagainya mendukung sebuah *iterable* sebagai masukan di *constructor*.  Sebagai contoh, bila saya ingin menampilkan deretan Fibonacci hasil dari *iterable* di atas dalam satu baris yang dipisahkan dengan tanda koma, saya bisa mengubahnya menjadi `Array` terlebih dahulu dengan menggunakan kode program seperti:

```javascript
console.log(Array.from(fibonacciIterator(10)).join(', '));
// Hasilnya: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34
```

*String* di JavaScript juga sebuah *iterable*.  Saya bisa menggunakan fakta ini untuk menyelesaikan pertanyaan interview: "Buat kode program JavaScript yang membalikkan sebuah *string*, tetapi hanya berlaku untuk huruf (a-z).  Semua karakter non-huruf seperti simbol dan angka harus tetap berada di posisi semula."  Solusi dengan menggunakan *iterable* akan terlihat seperti:

```javascript
const isLetter = (c) => c.match(/[a-z]/i);
const str = 'j@ck1h3nd#ry';
const reversed = Array.from(str).filter(isLetter).reverse();
const reversedIter = reversed[Symbol.iterator]();
const result = Array.from(str).map((c) => isLetter(c) ? reversedIter.next().value : c).join('');
console.log(result);  
// Hasilnya: y@rd1n3hk#cj
```

Dengan menggunakan `Array` dan *iterable*, solusi di atas bahkan tidak melibatkan *looping* dengan `for` sama sekali.

**Generator function** adalah sebuah *function* yang dideklarasikan dengan menggunakan `function*`.  Bila *function* ini dipanggil, ia akan mengembalikan *iterator* khusus yang disebut **generator**.  Di deklarasi *function*, keyword `yield` dapat dipakai untuk menghasilkan nilai baru di *iterator* yang dihasilkan.  Tujuan dari *generator* adalah membuat kode program *iterator* menjadi lebih sederhana.  Sebagai contoh, ini adalah versi `fibonnaciIterator` yang menggunakan *generator* :

```javascript
function* fibonacciGenerator(n) {
    let n1 = null;
    let n2 = null;
    let step = 0;
    while (step < n) {
        if (n1 == null) {
            n1 = 0;
            yield n1;
        } else if (n2 == null) {
            n2 = 1;
            yield n2;
        } else {
            const v = n1 + n2;
            yield v;
            n1 = n2;
            n2 = v;
        }
        step++;
    }
}
```

Kode program di atas terlihat lebih sederhana dibandingkan versi sebelumnya.  Karena *generator* kompatibel dengan *iterator*, saya tetap dapat menggunakannya di `for...of`  dan tempat lain dimana *iterator* diharapkan, seperti:

```javascript
for (const x of fibonacciGenerator(10)) {
    console.log(x);
}

console.log(Array.from(fibonacciGenerator(10)).join(', '));
// Hasilnya: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34

const [a, b, c] = fibonacciGenerator(10);
console.log(a, b, c);  
// Hasilnya 0 1 1
```

Selain `yield`, juga terdapat `yield*` yang merupakan cara singkat untuk men-*yield* nilai dari *iterator* yang sudah ada satu per satu.  Sebagai contoh, karena sudah ada *iteratable* `fibonacciIterator`, saya bisa menggunakannya di `fibonacciGenerator` seperti:

```javascript
function* fibonacciGenerator(n) {
    yield* fibonacciIterator(n);
}

console.log(Array.from(fibonacciGenerator(10)).join(', ')) 
// Hasilnya: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34
```

Di Node.js, *stream* juga adalah sebuah *async generator* dan *async iterator*.  Dengan demikian, untuk membaca dari file dengan menggunakan `Readable` *stream*, saya bisa menggunakan kode program seperti:

```javascript
import {createReadStream} from 'fs';
import {createGunzip} from 'zlib';

const stream = createReadStream('data.gz').pipe(createGunzip());
for await (const chunk of stream) {
    console.log(chunk.toString());
}
```

Kode program di atas akan meng-ekstrak sebuah file terkompresi menggunakan *stream* yang dihasilkan oleh `zlib.createGunzip()`.  Untuk menampilkan isi file, biasanya saya akan  menggunakan *callback* pada *event* `'data'`.  Akan tetapi, pada contoh di atas, saya menggunakan `for await` yang terlihat sedikit lebih sederhana.

Sebaliknya, saya juga bisa menulis ke `Writable` *stream* dari *async iterator*, seperti pada contoh kode program berikut ini:

```javascript
import {createGzip} from 'zlib';
import {Readable, Transform} from 'stream';
import {pipeline} from 'stream/promises';
import {createWriteStream} from 'fs';

function* fibonacciGenerator(n) {
    let n1 = null;
    let n2 = null;
    let step = 0;
    while (step < n) {
        if (n1 == null) {
            n1 = 0;
            yield n1;
        } else if (n2 == null) {
            n2 = 1;
            yield n2;
        } else {
            const v = n1 + n2;
            yield v;
            n1 = n2;
            n2 = v;
        }
        step++;
    }
}

await pipeline(
    Readable.from(fibonacciGenerator(1000), {objectMode: true}),
    new Transform({
        transform(chunk, encoding, callback) {
            callback(null, `${BigInt(chunk).toString()}\n`);
        },
        objectMode: true,
    }),
    createGzip(),
    createWriteStream('output.gz'),
);
```

Pada kode program di atas, saya menggunakan `Readable.from()` untuk menghasilkan sebuah `Readable` *stream* dari *generator* `fibonacciGenerator`.  Saya kemudian mengarahkan `Readable` *stream* ini ke sebuah `Transform` *stream* buatan sendiri yang akan menerjemahkan angka menjadi string karena *stream* dari `fs` hanya bekerja dengan *string* atau `Buffer` saja.  Tujuan berikutnya adalah `Gzip` *stream* dari `zlib`  yang akan melakukan kompresi data.  Hasil terkompresi kemudian diarahkan ke sebuah `Writable` *stream* yang akan menulis ke file dengan nama `output.gz`.  Bila saya membuka dan melakukan dekrompresi berkas tersebut, saya akan menemukan 1.000 deretan Fibonacci pertama di file `output`.