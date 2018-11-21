---
layout: post
category: Pemograman
title: Dari MySQL Ke Algolia Melalui Python
tags: [SearchEngine, MySQL, Python]
---

Hari ini saya harus melakukan operasi *indexing* di Algolia berdasarkan data dari database MySQL yang sudah ada.  Saya hanya memiliki akses ke database tersebut tanpa kode program.  Saya tidak menemukan *tools* otomatis untuk melakukan hal ini seperti layaknya Logstash di ELK (Elasticsearch, Logstash, Kibana).  Beruntungnya, tidak sulit untuk menulis kode program yang membaca dari database MySQL dan mengirimkannya ke Algolia karena Algolia telah menyediakan *libray* pendukung di beberapa bahasa pemograman populer.  Pertanyaannya adalah saya harus menulis dalam bahasa pemograman apa?  Ini pastinya adalah sebuah *script* CLI dan bukannya aplikasi web; oleh sebab itu saya tidak akan menggunakan bahasa favorit saya: Java.  Setelah berpikir sejenak, saya menyadari bahwa satu-satunya bahasa pemograman yang saya kuasai dan tepat untuk CLI adalah Python.

Sayapun segera membuat proyek baru di PyCharm.  Pada konfigurasi *Virtualenv* proyek tersebut, saya memastikan bahwa saya menggunakan Python3.  Selain itu, saya membuat file `requirements.txt` dengan isi seperti berikut ini:

```
algoliasearch==1.17.0
certifi==2018.10.15
chardet==3.0.4
Click==7.0
colorama==0.4.0
idna==2.7
mysql==0.0.2
mysql-connector-python==8.0.13
mysqlclient==1.3.13
protobuf==3.6.1
requests==2.20.1
six==1.11.0
urllib3==1.24.1
```

PyCharm dengan pintar akan menyarankan untuk men-*install* Python *package* yang dibutuhkan di file `requirements.txt`.  Beberapa paket yang penting yang saya pakai adalah `mysql-connector-python`, `algoliasearch` dan `Click`.  Paket `mysql-connector-python` dibutuhkan untuk melakukan query ke database MySQL, sementara itu paket `algoliasearch` dipakai untuk menambahkan *object* baru di *index* Algolia.  Paket `Click` akan membuat pemograman aplikasi CLI menjadi lebih mudah dan sebagai pemanis, paket `colorama` akan memberikan warna pada tampilan CLI yang membosankan.

Setelah paket yang dibutuhkan semuanya berhasil ter-*install*, saya segera memilih menu **Tool**, **Create setup.py** di PyCharm.  Saya pun mengisi informasi program di kotak dialog *New Setup Script* dan menekan tombol **Ok**.  Hasilnya adalah sebuah file baru dengan nama `setup.py`.  File ini dibutuhkan untuk `Distutils` yang akan mempermudah distribusi dan instalasi aplikasi Python, terutama aplikasi CLI seperti yang sedang saya buat.  Karena menggunakan `Click`, saya perlu melakukan sedikit perubahan pada file `setup.py` yang dihasilkan PyCharm sehingga terlihat seperti berikut ini:

```python
from setuptools import setup, find_packages

setup(
    name='my-migration',
    version='1.0',
    packages=find_packages(),
    include_package_data=True,
    author='jocki',
    description='My migration app',
    entry_points='''
        [console_scripts]
        my-migration=migration:cli
    '''
)
```

Bagian yang penting disini adalah `entry_points`.  Nilai `my-migration` menunjukkan nama perintah yang nantinya akan dipakai untuk menjalankan aplikasi ini di terminal.  Sementara itu, nilai `migration:cli` menunjukkan bahwa kode program utama terletak di file `migration.py`.

Akan tetapi, sebelum membuat file `migration.py`, saya akan membuat file `database.py` terlebih dahulu.  Isinya terlihat seperti pada kode program berikut ini:

```python
import sys
from contextlib import closing

import click
import mysql.connector

config = {
    'user': 'nama_user',
    'password': 'password_user',
    'host': 'server_database',
    'database': 'nama_database',
    'raise_on_warnings': True
}


def query(sql):
    try:
        with closing(mysql.connector.connect(**config)) as cnx:
            with closing(cnx.cursor(dictionary=True)) as cursor:
                cursor.execute(sql)
                return cursor.fetchall()
    except mysql.connector.Error as err:
        click.secho('Error: {}'.format(err.msg), fg='red')
        sys.exit()
```

Pada contoh di atas, kode program `query()` akan menggunakan `mysql-connector-python` untuk mengerjakan sebuah query dan mengembalikan hasilnya dalam bentuk *dictionary*.  Programmer Java akan lebih mengenal struktur data ini sebagai `Map`.

Sekarang saatnya membuat file `migration.py` dengan isi seperti berikut ini:

```python
import click
from algoliasearch import algoliasearch

import database

ALGOLIA_CLIENT_ID = 'ganti_dengan_kode_rahasia_dari_algolia'
ALGOLIA_API_KEY = 'ganti_dengan_kode_rahasia_dari_algolia'


def convert(item):
    return {
        'objectId': item['id'],
        'name': item['name'],
        'price': float(item['sellingPrice']),
        'qty': int(item['qty']),
        'category': item['category']
    }


@click.group()
def cli():
    pass


@cli.command()
@click.option('--force', is_flag=True)
@click.option('--chunk', '-c', default=1000)
@click.option('--index-name', '-i', default='items')
def algolia(force, chunk, index_name):
    """Exports items table from MySQL to Algolia"""
    items = database.query("SELECT i.id, i.name, i.sellingPrice, i.qty, c.name AS category FROM item i "
                           "LEFT JOIN category c on p.id = c.id")
    click.secho("Found %d records in items table" % len(items), fg='green')
    if len(items) == 0:
        click.echo('Nothing happened.')
    else:
        if not force and not click.confirm('Exporting to Algolia will decrease your operations quota.  Do you want to '
                                           'continue?'):
            return
        else:
            client = algoliasearch.Client(ALGOLIA_CLIENT_ID, ALGOLIA_API_KEY)
            index = client.init_index(index_name)
            with click.progressbar([[convert(i) for i in j] for j in [items[k:k+chunk] for k in range(0, len(items), chunk)]],
                                   label="Adding objects to index %s" % index_name) as bar:
                for items in bar:                    
                    index.add_objects(items)
```

Kode program `convert()` berisi pemetaan dari *dictionary* yang diperoleh dari database ke struktur data JSON yang akan disimpan di Algolia.  Disini, saya menggunakan `objectId` yang merupakan nama khusus di Algolia untuk pengenal (*id*) sebuah *object* di Algolia.  Bila nilai `objectId` ini sudah pernah dipakai, Algolia tidak akan membuat *object* baru melainkan memperbaharui *object* dengan `objectId` yang sama tersebut.

Penggunaan *decorator* seperti `@click.group()` dan `@click.option()` merupakan fasilitas dari `Click`.  *Decorator* `@cli.command()` (nilai `cli` disini merujuk pada function `cli()`) menunjukkan bahwa function `algolia()` adalah sebuah *sub command* yang bisa dikerjakan dengan perintah seperti `my-migration algolia`.  Dengan demikian, saya bisa membuat *sub command* baru suatu hari nanti cukup dengan menambahkan function baru.

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Walaupun <em>decorator</em> terlihat mirip seperti <em>annotation</em> di Java karena sama-sama diawali dengan <code>@</code>, cara kerja mereka sangat jauh berbeda.  <em>Decorator</em> di Python adalah sebuah <em>function</em> yang bisa dikerjakan sementara <em>annotation</em> di Java hanya berperan sebagai penanda atau pemberi informasi (<em>metadata</em>).
</div>

`Click` juga menyediakan beberapa utilitas berguna seperti `click.confirm()` untuk meminta konfirmasi dari pengguna dan `click.progressbar()` untuk menampilkan perkembangan saat mengerjakan sesuatu yang lama.

Pada function `algolia()`, saya menggunakan *list comprehension* untuk mempersingkat kode program.  Ini adalah fitur yang unik yang hanya ada di Python.  Walaupun mungkin terlihat aneh, programmer penggemar matematika akan suka dengannya!  Sebagai contoh `[items[i:i+chunk] for i in range(0, len(items), chunk)]` akan menciptakan sebuah *list* baru.  Ekspresi `range(0, len(items), chunk)` akan menghasilkan *list* dengan nilai berupa `[0, chunk, chunk*2, chunk*3, ..., len(items)]`.  Dengan demikian, *list comprehension* tersebut akan menghasilkan  nilai seperti `[items[0:0+chunk], items[chunk:chunk+chunk*2], items[chunk+chunk*2:chunk+chunk*2+chunk*3], ...]`.  Kode program `items[i:i+chunk]` akan membuat *list* baru berdasarkan isi *list* `items` mulai dari elemen `i` hingga sebelum elemen `i+chunk`.  Jadi, hasil akhir dari *list comprehension* ini adalah sebuah *list* yang mengandung *list* yang dibagi dengan ukuran rata sebanyak `chunk`.  Singkat sekali, bukan?  Pada bahasa lain, ini minimal membutuhkan beberapa baris!

Bukan hanya itu, *list comprehension* juga dapat mengandung *list comprehension* lainnya (*nested*) seperti `[[convert(i) for i in j] for j in bar]`.  Yang ini menghemat dua kali *for loop*!  Bandingkan lagi dengan *list comprehension* yang saya tulis di kode program saya: `[[convert(i) for i in j] for j in [items[k:k+chunk] for k in range(0, len(items), chunk)]]`.  Yang ini setara dengan tiga kali *for loop*.  Luar biasa singkat, bukan?

Mengapa membagi isi tabel ke dalam *chunks*?  Karena saya tidak ingin memanggil `index.add_objects()` untuk setiap *record* yang ada.  Akan lebih efisien bila saya mengirim banyak *objects* bersamaan setiap kali memanggil *endpoint* Algolia selama jumlah *objects* tersebut tidak melebihi *limit* yang ada.

Untuk menjalankan aplikasi CLI ini tanpa melakukan instalasi, saya bisa membuka sebuah **Terminal** baru di PyCharm.  Setiap *terminal* di PyCharm sudah dilengkapi dengan aktivasi *Virtualenv*.  Bila saya membuka *terminal* di sistem operasi, saya perlu memberikan perintah `virtualenv venv` dan `. venv/bin/activate` untuk mencapai hasil yang sama.  Setelah itu, saya memberikan perintah berikut ini:

> $ <strong>pip install --editable .</strong>

Sekarang, bila saya memberikan perintah `my-migration` di terminal, saya akan menemukan hasil seperti berikut ini:

> $ <strong>my-migration</strong>

```
Usage: my-migration [OPTIONS] COMMAND [ARGS]...

Options:
  --help  Show this message and exit.

Commands:
  algolia  Exports items table from MySQL to Algolia
```

Untuk menampilkan informasi *sub command* `algolia`, saya bisa memberikan perintah seperti berikut ini:

> $ <strong>my-migration algolia --help</strong>

```
Usage: my-migration algolia [OPTIONS]

  Exports items table from MySQL to Algolia

Options:
  --force
  -c, --chunk INTEGER
  -i, --index-name TEXT
  --help                 Show this message and exit.
```

Untuk mengerjakan *script* ini dengan nilai *default*, saya cukup memberikan perintah seperti berikut ini:

> $ <strong>my-migration algolia</strong>

![Tampilan Aplikasi CLI]({{ "/assets/images/gambar_00023.png" | relative_url}}){:class="img-fluid rounded"}