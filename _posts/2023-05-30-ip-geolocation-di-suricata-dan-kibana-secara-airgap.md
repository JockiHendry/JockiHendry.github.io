---
layout: post
category: Network
title: Memakai IP Geolocation Di Suricata dan Kibana Tanpa Koneksi Internet
tags: [Suricata, ElasticStack]
---

Pada suatu hari, saya melakukan instalasi Suricata dan Kibana di sebuah perangkat rumah untuk menjadikannya sebagai 
monitor jaringan.  Perangkat rumah ini hanya memiliki sebuah kartu jaringan yang terhubung ke SPAN port (mirror) tanpa 
kemampuan melakukan koneksi Internet keluar.  Walaupun demikian, instalasi Suricata, Elasticsearch, Kibana, dan Filebeat 
berhasil dilakukan dengan lancar.  Dashboard Kibana yang berisi daftar *events* dan *alerts* Suricata pun bekerja dengan
baik.  Hanya saja beberapa visualiasi seperti *Top Source Countries* dan *Top Destination Countries* selalu memiliki 
nilai yang kosong.  Begitu juga dengan versi peta-nya, tidak ada data yang ditampilkan.  Apa yang harus saya lakukan 
agar visualisasi IP geolocation tersebut dapat bekerja dengan baik?

Langkah pertama yang saya lakukan adalah mendapatkan database GeoLite2 dari MaxMind.  Informasi lebih lanjut mengenai 
registrasi dan proses download dapat dilihat di <https://dev.maxmind.com/geoip/geoip2/geolite2/>.  Bila tidak ingin 
repot melakukan registrasi, saya juga dapat menggunakan kata kunci `GeoLite2-Country.mmdb`, `GeoLite2-City.mmdb` dan 
`GeoLite2-ASN.mmdb` di Google untuk mencari file yang siap pakai untuk di-*download*.  Setelah mendapatkan ketiga 
file tersebut, saya meletakkannya ke lokasi instalasi Elasticsearch di `C:\Program Files\elasticsearch-8.7.1\config\ingest-geoip`.

Untuk memastikan IP geolocation bekerja dengan baik, saya membuka menu **Management**, **Dev Tools** di Kibana dan 
memberikan *request* seperti berikut ini:

```
POST _ingest/pipeline/_simulate
{
  "pipeline": {
    "processors": [
      {
        "geoip": {
          "field": "location"
        }
      }
    ]
  },
  "docs": [
    {
      "_source": {
        "location": "185.199.109.153"
      }
    }
  ]
}
```

Bila *GeoIP processor* bekerja dengan baik, saya akan mendapatkan *response* seperti berikut ini:

```json
{
  "docs": [
    {
      "doc": {
        "_index": "_index",
        "_id": "_id",
        "_version": "-3",
        "_source": {
          "location": "185.199.109.153",
          "geoip": {
            "continent_name": "North America",
            "region_iso_code": "US-CA",
            "city_name": "San Francisco",
            "country_iso_code": "US",
            "country_name": "United States",
            "region_name": "California",
            "location": {
              "lon": -122.3993,
              "lat": 37.7642
            }
          }
        },
        "_ingest": {
          "timestamp": "2023-05-29T00:00:00.000Z"
        }
      }
    }
  ]
}
```

Karena perangkat ini tidak memilikii koneksi Internet, saya dapat mematikan salah satu fitur *GeoIP processor* yang akan 
berusaha memeriksa perbaharuan database GeoIP secara berkala.  Saya dapat melakukannya dengan memberikan *request* seperti berikut ini:

```
PUT _cluster/settings
{
  "persistent": {
    "ingest.geoip.downloader.enabled": false
  }
}
```

Setelah ini, saya akan menemukan *property* seperti `destination.as.organization.name`, `destination.geo.location`, 
`destination.geo.country_name` dan sebagainya untuk alamat IP publik seperti yang terlihat pada gambar berikut ini:

![Informasi IP Geolocation Di Event Suricata]({{ "/assets/images/gambar_00105.png" | relative_url}}){:class="img-fluid rounded"}

<div class="alert alert-info" role="alert">
Proses penambahan informasi <em>geolocation</em> dilakukan oleh Elasticsearch saat menyimpan dokumen yang berisi alamat IP.  
Tidak ada yang perlu dimodifikasi pada Suricata ataupun Filebeat.
</div>

Sampai disini, visualisasi tabel seperti *Top Source Countries* dan *Top Destination Countries* sudah muncul dengan baik.  
Walaupun demikian, visualisasi peta masih belum bekerja dengan baik tanpa koneksi Internet.  Sebagai contoh, saya 
mendapatkan peta kosong seperti yang terlihat pada gambar berikut ini:

![Visualisasi peta tanpa Internet]({{ "/assets/images/gambar_00106.png" | relative_url}}){:class="img-fluid rounded"}

Hal ini karena untuk menampilkan peta, Kibana perlu melakukan koneksi ke Elastic Maps Service (EMS) di `tiles.maps.elastic.co` 
dan `vector.maps.elastic.co`.  Pada kondisi *airgap* (tanpa koneksi Internet), saya wajib menggunakan server peta yang dapat
diakses oleh mesin.  Salah satu solusi dari Elastic Stack adalah Elastic Maps Server yang menyediakan EMS dalam bentuk instalasi 
lokal (Docker).  Sayangnya, Elastic Maps Server membutuhkan lisensi tersendiri yang tidak gratis.

Sebagai alternatif, saya akan memakai MapTiler Server yang dapat di-download secara gratis di <https://www.maptiler.com/server/>.  
Walaupun server peta ini dapat dipakai secara gratis di komputer lokal tanpa koneksi Internet, saya tetap perlu  men-*download* 
salah satu dataset di <https://data.maptiler.com/downloads/planet>.  Hanya *OpenStreetMap vector tiles* yang dapat di-*download* 
tanpa biaya  dengan ukuran sekitar 70 GB.  Karena ukurannya terlalu besar, saya akan mencoba menggunakan *test package* 
yang dapat di-*download* di <https://data.maptiler.com/maps> yang hanya berukuran 263 MB.  Dataset ini sebenarnya hanya
untuk *demo* dan tidak berisi informasi yang lengkap untuk peta dunia.

Setelah melakukan instalasi MapTiler Server dan menjalankannya, saya dapat mengakses halaman administrasi peta di <http://localhost:3650/admin>.  
Saya kemudian memilih menu **Maps** dan menambahkan peta `maptiler-server-map-styles-3.14.zip`.  Setelah itu, saya 
men-klik tombol **Details** pada peta *Satellite-Hybrid*.  Disini saya akan menemukan URL yang dapat dipakai untuk mengakses
peta dalam format seperti `http://localhost:3650/api/maps/satellite-hybrid/{z}/{x}/{y}.jpg`.  Saya dapat menggunakan URL ini 
sebagai nilai `map.tilemap.url` di `kibana.yml`.  Sebagai contoh, berikut ini penambahan yang saya lakukan pada file `kibana.yml`:

```
map.includeElasticMapsService: false
map.tilemap.url: "http://localhost:3650/api/maps/satellite-hybrid/{z}/{x}/{y}.jpg"
```

Setelah me-*restart* Kibana dan membuka kembali dashboard Suricata, visualisasi peta kini akan menggunakan *raster* dari MapTiler Server 
seperti yang terlihat pada gambar berikut ini:

![Visualisasi peta di Kibana dengan MapTiler Server]({{ "/assets/images/gambar_00107.png" | relative_url}}){:class="img-fluid rounded"}