---
layout: post
category: DevOps
title: Menerapkan GitOps Di Kubernetes Dengan kpt
tags: [Kubernetes]
---

GitOps adalah sebuah konsep dimana aplikasi yang di-*deploy* diwakili oleh sebuah *repository* Git.  Perubahan pada infrastruktur harus dilakukan dengan menambahkan *commit* baru ke *repository* Git tersebut yang nantinya akan diaplikasikan ke server (*infrastructure as code*).  Dengan demikian, seluruh riwayat perubahan pada infrastruktur dapat dilihat dari riwayat *commit* di *repository*.  Salah satu hal penting di GitOps adalah tidak melakukan perubahan secara langsung ke server atau perubahan manual lainnya yang tidak terdokumentasikan di *repository*.  Pada tulisan ini, saya akan menggunakan [kpt](https://kpt.dev) untuk mempermudah menerapkan GitOps.

<div class="alert alert-info" role="alert">
<strong>INFORMASI:</strong> Blog ini juga mengikuti filosifi yang hampir sama seperti GitOps.  Tidak ada database seperti MySQL untuk menyimpan artikel seperti di Wordpress.  Sebagai gantinya, seluruh perubahan artikel di blog ini dapat dilihat di <em>commit history</em> di <a href="https://github.com/JockiHendry/JockiHendry.github.io/commits/master">https://github.com/JockiHendry/JockiHendry.github.io/commits/master</a>.  Setiap kali saya menulis artikel baru, saya akan membuat <em>commit</em> baru.  Dengan demikian, untuk mendapatkan informasi artikel baru, seseorang dapat menggunakan fasilitas <em>watch</em> di GitHub yang akan mengirim notifikasi bila ada <em>commit</em> baru.  
</div>

Saya sudah memiliki folder [kubernetes](https://github.com/JockiHendry/latihan-k8s/tree/594b41754704e07d701514f16a8e7f21b5937096/kubernetes) yang mewakili infrastruktur Kubernetes.  Saat ini saya mengelolanya secara manual dengan `kubectl apply` dan hanya ada sebuah script [init.sh](https://github.com/JockiHendry/latihan-k8s/blob/594b41754704e07d701514f16a8e7f21b5937096/kubernetes/helm/init.sh) untuk membantu instalasi *chart* Helm.  Pada tulisan ini, saya akan menggunakan kpt untuk memudahkan saya menerapkan GitOps.  Langkah pertama yang perlu saya lakukan adalah mengubah folder ini menjadi sebuah *package* kpt dengan memberikan perintah seperti berikut ini (saat berada di folder tersebut):

> <strong>$</strong> <code>kpt pkg init</code>

Perintah ini akan membuat sebuah file baru dengan nama `Kptfile` di folder yang sama.  Ini adalah file konfigurasi kpt dimana saya dapat memberikan informasi seperti nama dan informasi *package*.  Saya juga bisa mendeklarasikan pemanggilan functions bawaan kpt yang akan dikerjakan secara deklaratif di file ini.

---

### Memastikan Chart Helm Selalu Sama 

Salah satu cara paling sederhana untuk memakai Helm bersamaan dengan kpt adalah dengan memberikan perintah `helm template`.  Perintah ini akan menghasilkan file *manifest* dari *chart* yang dibutuhkan sebagai bagian dari proyek saya.  Namun ini juga berarti kini file tersebut, sama seperti file *manifest* lainnya, akan dikelola oleh kpt.  File *manifest* yang dihasilkan perintah `helm template` tidak akan dikenali oleh `helm` lagi (misalnya saya tidak bisa memperintah perintah seperti `helm upgrade` dan sebagainya).  Dengan demikian, bila ingin memperbaharui *dependency*, saya harus melakukan perubahan secara manual di file *manifest* yang ada.  Tapi secara tidak langsung, ini juga memberikan lebih banyak fleksibilitas (misalnya saya dapat melakukan enkripsi pada file *manifest* Secret yang dipakai oleh *dependency* tersebut).

Berikut ini adalah contoh perintah `helm template` yang saya berikan:

> <strong>$</strong> <code>helm template keycloak bitnami/keycloak -f helm/keycloak-values.yaml --output-dir=.</code>

> <strong>$</strong> <code>helm template mongodb-item-stock bitnami/mongodb -f helm/mongodb-stock-item-values.yaml --output-dir=.</code>

> <strong>$</strong> <code>helm template rabbitmq bitnami/rabbitmq -f helm/rabbitmq-values.yaml --output-dir=.</code>

> <strong>$</strong> <code>helm template elasticsearch elastic/elasticsearch -f helm/elasticsearch-values.yaml --output-dir=.</code>

Setelah perintah di atas selesai diberikan, saya akan menemukan folder `elasticsearch`, `mongodb`, `keycloak`, dan `rabbitmq` yang berisi file *manifest* Kubernetes berdasarkan definisi *chart* mereka.  Bila saya memberikan perintah `kpt pkg tree`, saya dapat melihat bahwa setiap folder yang ada merupakan bagian dari *package* utama saya seperti pada:

> <strong>$</strong> <code>kpt pkg tree</code>

```
Package "kubernetes"
├── [Kptfile]  Kptfile latihan-k8s
├── [ingress-api.yaml]  Ingress ingress-api
├── [ingress-web.yaml]  Ingress ingress-web
├── [stock-item-service.yaml]  Deployment stock-item-service
├── [stock-item-service.yaml]  Service stock-item-service
├── [web-service.yaml]  Deployment angular-web
├── [web-service.yaml]  Service angular-web
├── templates
│   ├── [configmap.yaml]  ConfigMap elasticsearch-master-config
│   ├── [poddisruptionbudget.yaml]  PodDisruptionBudget elasticsearch-master-pdb
│   ├── [service.yaml]  Service elasticsearch-master
│   ├── [service.yaml]  Service elasticsearch-master-headless
│   ├── [statefulset.yaml]  StatefulSet elasticsearch-master
│   └── test
│       └── [test-elasticsearch-health.yaml]  Pod elasticsearch-ztret-test
├── templates
│   ├── [secrets.yaml]  Secret default/keycloak-postgresql
│   ├── [statefulset.yaml]  StatefulSet default/keycloak-postgresql
│   ├── [svc-headless.yaml]  Service default/keycloak-postgresql-headless
│   └── [svc.yaml]  Service default/keycloak-postgresql
├── templates
│   ├── [configmap-env-vars.yaml]  ConfigMap default/keycloak-env-vars
│   ├── [headless-service.yaml]  Service default/keycloak-headless
│   ├── [ingress.yaml]  Ingress default/keycloak
│   ├── [secrets.yaml]  Secret default/keycloak
│   ├── [service.yaml]  Service default/keycloak
│   ├── [serviceaccount.yaml]  ServiceAccount default/keycloak
│   ├── [statefulset.yaml]  StatefulSet default/keycloak
│   └── [tls-secret.yaml]  Secret default/auth.latihan.jocki.me-tls
├── templates
│   ├── [secrets.yaml]  Secret default/mongodb-item-stock
│   ├── [serviceaccount.yaml]  ServiceAccount default/mongodb-item-stock
│   └── standalone
│       ├── [dep-sts.yaml]  Deployment default/mongodb-item-stock
│       ├── [pvc.yaml]  PersistentVolumeClaim default/mongodb-item-stock
│       └── [svc.yaml]  Service default/mongodb-item-stock
└── templates
    ├── [configuration.yaml]  ConfigMap default/rabbitmq-config
    ├── [role.yaml]  Role default/rabbitmq-endpoint-reader
    ├── [rolebinding.yaml]  RoleBinding default/rabbitmq-endpoint-reader
    ├── [secrets.yaml]  Secret default/rabbitmq
    ├── [serviceaccount.yaml]  ServiceAccount default/rabbitmq
    ├── [statefulset.yaml]  StatefulSet default/rabbitmq
    ├── [svc-headless.yaml]  Service default/rabbitmq-headless
    └── [svc.yaml]  Service default/rabbitmq
```

File baru yang dihasilkan perintah `helm template` di atas adalah file *manifest* biasa sehingga mereka dapat di-*deploy* dengan menggunakan perintah seperti `kubectl apply -f --rescursive` atau `kpt live apply` sama seperti file *manifest* pada umumnya.

---

### Melakukan Konfigurasi Secara Deklaratif dan Imperatif

Pada kpt, functions adalah kumpulan perintah yang dapat dipakai untuk melakukan perubahan pada file konfigurasi Kubernetes.  Implementasi functions berada dalam bentuk *image* Docker yang dapat dipanggil secara deklaratif atau imperatif.  Pemanggilan secara imperatif lebih tepat dipakai untuk operasi yang hanya dibutuhkan sekali-kali, sementara pemanggilan secara deklaratif lebih tepat dipakai untuk perubahan yang perlu dilakukan berulang kali (setiap kali melalukan *deployment*).

Sebagai contoh, saya ingin menambahkan *label* tertentu ke seluruh *resources* yang ada.  Untuk itu, saya bisa memanggil functions `set-labels` secara deklaratif dengan menambahkan baris berikut ini pada file `Kptfile`:

```yaml
apiVersion: kpt.dev/v1
kind: Kptfile
metadata:
  name: latihan-k8s
info:
  description: Ini adalah proyek latihan untuk belajar memakai Kubernetes.  
pipeline:
  mutators:
    - image: gcr.io/kpt-fn/set-labels:v0.1.5
      configMap:
        app.kubernetes.io/version: v0.0.1
        env: staging        
```

Pada deklarasi di atas, saat *package* ini di-*render*, kpt akan menjalankan function `set-labels` yang menambahkan *label* `app.kubernetes.io/version` dan `env` ke seluruh file *manifest* yang ada di folder ini (termasuk sub folder-nya).  Proses pengerjaan functions deklaratif di kpt disebut sebagai operasi *render*, yang dapat dilakukan dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kpt fn render</code>

Saat men-*deploy* *package* ini di *server* lain, bila saya ingin memakai nilai `env` berbeda, saya cukup mengubah nilai label yang ada di file `Kptfile` dan me-*render* ulang *package*.   Ini lebih praktis daripada harus mengubah file satu per satu.  Walaupun demikian, kpt tidak mewajibkan harus melalui proses *render*.  Bila saya ingin melakukan perubahan secara manual dengan mengubah file *manifest*, hal tersebut tetap diperbolehkan.

Selain *label*, saya juga dapat mengubah versi (*tag*) *image* Docker yang dipakai di *package*.  `kpt` memiliki functions universal untuk substitusi nilai: `create-setters` dan `apply-setters`.  Function `create-setters` dipakai untuk membuat placeholder nilai yang hendak di-substitusi yang disebut sebagai *setters*.  Karena ia hanya dipanggil sekali saja, saya dapat mengeksekusinya secara imperatif dengan menggunakan perintah seperti berikut ini:

> <strong>$</strong> <code>kpt fn eval -i create-setters:v0.1.0 -- \</code>
<br><code>elasticsearch_version=7.15.0 \</code>
<br><code>keycloak_postgre_version=11.14.0-debian-10-r0 \</code>
<br><code>keycloak_version=15.0.2-debian-10-r94 \</code>
<br><code>mongodb_version=4.4.10-debian-10-r44 \</code>
<br><code>rabbitmq_version=3.9.11-debian-10-r0 \</code>
<br><code>stock_item_service_version=edge \</code>
<br><code>web_service_version=edge</code>

Untuk memastikan bahwa *setters* sudah dibuat, saya dapat menjalan functions `list-setters` seperti yang terlihat pada perintah berikut ini:

> <strong>$</strong> <code>kpt fn eval -i list-setters:v0.1.0 --truncate-output=false</code>

```
[RUNNING] "gcr.io/kpt-fn/list-setters:v0.1.0"
[PASS] "gcr.io/kpt-fn/list-setters:v0.1.0" in 1.1s
  Results:
    [info]: Name: elasticsearch_version, Value: 7.15.0, Type: str, Count: 3
    [info]: Name: keycloak_postgre_version, Value: 11.14.0-debian-10-r0, Type: str, Count: 1
    [info]: Name: keycloak_version, Value: 15.0.2-debian-10-r94, Type: str, Count: 1
    [info]: Name: mongodb_version, Value: 4.4.10-debian-10-r44, Type: str, Count: 1
    [info]: Name: rabbitmq_version, Value: 3.9.11-debian-10-r0, Type: str, Count: 1
    [info]: Name: stock_item_service_version, Value: edge, Type: str, Count: 1
    [info]: Name: web_service_version, Value: edge, Type: str, Count: 1
```

Disini terlihat bahwa ada 7 *setters* yang saya ubah nilainya secara cepat melalui functions `apply-setters`.  Sebagai latihan, saya akan menambahkan pemanggilan `apply-setters` secara deklaratif di `Kptfile` sehingga isinya terlihat seperti berikut ini:

```yaml
...
pipeline:
  mutators:
    - ...
    - image: gcr.io/kpt-fn/apply-setters:v0.2.0
      configMap:
        elasticsearch_version: 7.15.0
        keycloak_postgre_version: 11.14.0-debian-10-r0
        keycloak_version: 15.0.2-debian-10-r94
        mongodb_version: 4.4.10-debian-10-r44
        rabbitmq_version: 3.9.11-debian-10-r0
        stock_item_service_version: edge
        web_service_version: edge
```

Sekarang, setiap kali ingin melakukan perubahan versi *tag*, saya hanya perlu mengubah nilai `configMap` untuk functions `apply-setters` di file `Kptfile` di atas.  Begitu saya me-*render* *package*, *setters* di file *manifest* yang bersangkutan akan berisi nilai yang saya tentukan.

---

### Menyimpan File Sensitif Di Git Repository

Kubernetes memiliki *object* yang disebut Secret yang dapat dipakai untuk menampung data sensitif seperti password dan sertifikat.  Walaupun demikian, bagi Kubernetes, Secret pada dasarnya hanya sebuah ConfigMap yang spesial yang isi-nya tidak mudah dilihat.  Untuk mendeklarasikan Secret, saya tetap perlu membuat file *manifest* yang isinya tidak dilindungi.  Sementara itu, bila mengikuti filosofi GitOps, semua yang dibutuhkan untuk membangun infrastruktur harus diletakkan ke dalam *repository* Git, termasuk file *manifest* Secret.  Kalau begitu, bukankah siapa saja bisa melihat isi password atau sertifikat dengan men-*download* file *manifest* Secret dari *repository* Git?  Ini tentu saja akan menimbulkan masalah keamanan.

Salah satu solusinya adalah dengan menggunakan tool seperti [Bitnami Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) dan [Mozilla SOPS: Secrets Operations](https://github.com/mozilla/sops).  Dengan tool tersebut, saya dapat meng-enkripsi Secret dan men-*commit* file *manifest* yang sudah di-enkripsi ke *repository* Git sehingga setiap perubahannya tetap tercatat oleh riwayat Git.  Bitnami Sealed Secrets dirancang khusus untuk dipakai di Kubernetes, sehingga lebih mudah dipakai dibandingkan dengan Mozilla SOPS.  Walaupun demikian, karena kpt memiliki functions [sops](https://catalog.kpt.dev/contrib/sops/v0.3/) yang akan memanggil Mozilla SOPS (tanpa perlu di-install di komputer lokal), saya akan menggunakannya. 

Mozilla SOPS mendukung *tool* Pretty Good Privacy (PGP) dan age.  Karena sistem operasi saya sudah dilengkapi dengan GNU Privacy Guard (GPG) yang merupakan implementasi OpenPGP, saya akan menggunakan pendekatan PGP.  Untuk itu, saya akan mulai dengan membuat sebuah *key* baru dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>gpg --full-generate-key</code>

Saya perlu menjawab beberapa pertanyaan mengenai identitas dan masa berlaku *key*.  Pada pertanyaan terakhir, saya perlu memastikan bahwa *key* tersebut **tidak** dilindungi oleh password dengan cara mengosongkan nilai password saat diminta.  Hal ini perlu dilakukan karena *key* tersebut akan dipakai secara programatis sehingga tidak akan ada kesempatan untuk memasukkan password lagi.  Ini juga berarti siapa saja yang mendapatkan *key* tersebut dapat langsung memakainya. 

Untuk memastikan *key* berhasil dibuat, saya dapat memberikan perintah berikut ini:

> <strong>$</strong> <code>gpg --list-secret-keys --keyid-format=long</code>

Saya perlu meyalin nilai *long key* (16 karakter) dari hasil perintah di atas.  Selain itu, saya juga perlu mendapatkan *public key* yang dihasilkan dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>gpg --armor --export {% raw %}[ganti_dengan_long_key_atau_fingerprint]{% endraw %}</code>

Saya kemudian membuat file `encrypt.yaml` dengan isi seperti berikut ini:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: encrypt-config
data:
  cmd: encrypt
  cmd-json-path-filter: '$[?(@.kind==''Secret'')]'
  unencrypted-regex: ^(kind|apiVersion|group|metadata)$  
  pgp: <ganti_dengan_long_key>
  cmd-import-pgp: |
    -----BEGIN PGP PUBLIC KEY BLOCK-----
    <ganti_dengan_isi_public_key>
    -----END PGP PUBLIC KEY BLOCK-----
```

File konfigurasi di atas akan dipakai sebagai parameter saat memanggil functions `sops`.  Daftar parameter selengkap dapat dilihat di <https://catalog.kpt.dev/contrib/sops/v0.3/>.  Sebagai contoh, saya mengisi nilai `cmd-json-path-filter` dengan ekspresi yang hanya menyertakan file *manifest* Secret sehingga hanya file Secret saja yang akan di-enkripsi.  Selain parameter untuk functions `sops`, saya juga dapat memasukkan parameter untuk Mozilla SOPS seperti `unencrypted-suffix`, `encrypted-suffix`, `encrypted-regex`, `unencrypted-regex`, dan sebagainya.

Proses enkripsi dapat dilakukan cukup melalui *public key* tanpa membutuhkan informasi *private key*.  Saya sudah menyertakan *public key* saya di `cmd-import-gpg` pada file `encrypt.yaml` di atas.  Sekarang, saatnya untuk melakukan proses enkripsi:

> <strong>$</strong> <code>kpt fn eval --image gcr.io/kpt-fn-contrib/sops:v0.3.0 --include-meta-resources --fn-config encrypt.yaml</code>

Setelah perintah selesai dikerjakan, bila saya membuka salah satu file *manifest* Secret, saya akan menemukan isi seperti:

```yaml
# Source: keycloak/charts/postgresql/templates/secrets.yaml
apiVersion: v1
kind: Secret
...
data:
  postgresql-postgres-password: 'ENC[AES256_GCM,data:mteNQbnrzYp9z0W2aWmVgg==,iv:aI6kPoJOx0Ob9lzq8F4ttIo0g9o8/2Bu1tAz/0BHQZU=,tag:LNls0/TxIlkMXMH2GhuMnA==,type:str]'
  postgresql-password: 'ENC[AES256_GCM,data:Q9sysBOAGJXev/Xg,iv:0NWCQqhtpaZimWl2WakTTYdW3R4H/otaYieVVNOz9og=,tag:/TD1tw324AOH/MxQO3+UMQ==,type:str]'
sops:
  ...
  mac: 'ENC[AES256_GCM,data:xXs/8DnSm8x7T5pqGB5k719fjudJMrXB6lN+Kp0hp4+PLeAng/NE3f/q4eH1op8yFkbob9iFMX0Ds+eKV63xRX+WhKORHZcZNl+N3vw9vKgDp0PeGgj+4s+BEd7X0Wl7GaZpmLBDrJUoJgS2ZjFsRm0uLeKjNL0k0qSSVAPP6pg=,iv:Baq0csftiEpGqqQQz7scLLNLXjC/THEr8/5ArdV2XQs=,tag:Cbt0qTTP/REQFzz1jtfz9Q==,type:str]'
  pgp:
  - created_at: '2021-12-29T07:40:28Z'
    enc: |
      -----BEGIN PGP MESSAGE-----
      ...
      -----END PGP MESSAGE-----
    fp: FFA6D9C42D878F5C
  unencrypted_regex: ^(kind|apiVersion|group|metadata)$
  version: 3.7.1
```

Mozilla SOPS akan mengubah nilai *password* ke dalam bentuk nilai seperti `ENC[AES256_GCM,data:...,type:str]`.  Selain itu, ia juga menambahkan *key* baru dengan nama `sops` yang berisi informasi enkripsi termasuk *message authentication code* (MAC).  Bila ada perubahan di data yang ter-enkripsi, termasuk perubahan urutan *key*, proses dekripsi akan gagal dengan pesan kesalahan seperti "MAC mismatch". Ini menunjukkan kemungkinan file tersebut tidak aman lagi. 

Lalu, bagaimana dengan proses dekripsi?  Saya tetap perlu memanggil functions `sops`, hanya saja kali ini menggunakan nilai `decrypt` untuk `cmd`.  Selain itu, saya perlu menyertakan *private key* karena ia dibutuhkan untuk proses dekripsi.  Sebagai contoh, saya akan membuat file baru dengan nama `decrypt.yaml` yang isinya seperti berikut ini:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: decrypt-config
data:
  cmd: decrypt
```

Setelah ini, saya bisa memanggil functions `sops` seperti berikut ini:

> <strong>$</strong> <code>kpt fn eval --image gcr.io/kpt-fn-contrib/sops:v0.3.0 --env SOPS_IMPORT_PGP="$(gpg --armor --export-secret-keys <ganti_dengan_key_id>)" --include-meta-resources --fn-config decrypt.yaml</code>

Pada perintah di atas, saya mengirim *private key* hasil perintah `gpg --export-secret-keys` langsung ke variabel `SOPS_IMPORT_PGP`.  Functions `sops` akan meng-*import* *private key* tersebut secara otomatis saat ia bekerja di dalam Docker.  Berbeda dengan *public key*, *private key* bersifat rahasia dan tidak boleh di-*commit* ke *repository* Git.  Bila mengerjakan perintah ini dari platform CI/CD, saya bisa meletakkannya ke fitur penyimpanan rahasia yang disediakan oleh platform tersebut.  Sebagai contoh, di GitHub Actions, saya dapat menambahkan *secret* dengan memilih halaman *repository*, **Settings**, **Secrets**, dan men-klik tombol **New repository secret**.

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Bila terjadi kegagalan dekripsi dengan pesan kesalahan verifikasi MAC (message authentication code), tambahkan <em>key</em> <code>ignore-mac</code> dengan nilai <code>"true"</code> pada file <code>decrypt.yaml</code>.
</div>

Salah satu efek samping dari penggunakan enkripsi adalah saya harus selalu melakukan dekripsi sebelum me-*render* *package*.  Saat ini, saya tidak menemukan cara untuk melewatkan *environment variable* yang berisi *private key* ke functions `sops` untuk dipanggil secara deklaratif (dengan didefinisikan di `Kptfile`).  Oleh sebab itu, saya tetap perlu mengerjakan functions `sops` secara imperatif saat melakukan *deployment*.  Efek samping lainnya adalah beberapa *tool* yang melakukan *merging* melalui Git akan bingung karena harus membandingkan *upstream* yang ter-enkripsi dengan *repository* lokal yang sudah di-dekripsi.

---

### Deployment Di Server Berbeda

Anggap saja saya berada di server dengan akses ke *cluster* Kubernetes.  Karena [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/22548f60c33b2a977b36b673a388e613f586d2d5) sekarang sudah menerapkan  GitOps, saya bisa menciptakan infrastruktur aplikasi tersebut berdasarkan informasi yang ada di *repository* GitHub tersebut.  Saya akan menyebut *repository* yang ada di GitHub ini sebagai *upstream*, sementara itu, saya juga akan membuat sebuah *repository* di *server* yang akan saya sebut sebagai lokal.  Untuk membuat *package* lokal, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>kpt pkg init</code>

> <strong>$</strong> <code>kpt live init</code>

Perintah `kpt live init` akan menambahkan *key* `inventory` di `Kptfile`.  Informasi ini tidak boleh dihapus dari file `Kptfile` di lokal karena nantinya akan dipakai untuk menghubungkan *repository* lokal ke *cluster* Kubernetes tujuan.  Saya juga bisa menyimpan dan men-push *repository* ini sebagai *repository* baru yang berbeda di server GitHub (sebagai *backup* dan juga dokumentasi perubahan).

Sekarang, saatnya untuk memakai *upstream* dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kpt pkg get https://github.com/JockiHendry/latihan-k8s.git/kubernetes@v0.0.1</code>

Perintah di atas akan mengambil file *manifest* dari folder `kubernetes` di *upstream* untuk *commit* dengan *tag* `kubernetes/v0.0.1`.  Selain menggunakan *tag*, saya juga bisa menggunakan nama *branch* seperti pada contoh berikut ini:

> <strong>$</strong> <code>kpt pkg get https://github.com/JockiHendry/latihan-k8s.git/kubernetes@main</code>

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Untuk memberikan versi pada <em>repository</em> di <em>upstream</em>, gunakan fitur tag dari Git seperti <code>git tag kubernetes/v0.0.1</code>.  Jangan lupa men-<em>push</em> tag tersebut <code>git push origin kubernetes/v0.0.1</code> agar bisa dilihat dan dipakai pengguna lainnya.
</div>

Perintah di atas akan membuat sebuah folder `kubernetes` dengan isi sesuai dengan yang ada di *repository* GitHub.  Folder ini akan dianggap sebagai *subpackage* seperti yang diperlihatkan oleh hasil perintah berikut ini:

> <strong>$</strong> <code>kpt pkg tree</code>

```
Package "local"
├── [Kptfile]  Kptfile local
└── Package "kubernetes"
    ├── [Kptfile]  Kptfile kubernetes
    ├── [decrypt.yaml]  ConfigMap decrypt-config
    ├── [encrypt.yaml]  ConfigMap encrypt-config
    ├── [ingress-api.yaml]  Ingress ingress-api
    ├── [ingress-web.yaml]  Ingress ingress-web
    ├── [stock-item-service.yaml]  Deployment stock-item-service
    ├── [stock-item-service.yaml]  Service stock-item-service
    ├── [tls-secret.yaml]  Secret tls-secret
    ├── [web-service.yaml]  Deployment angular-web
    ├── [web-service.yaml]  Service angular-web
    ...
```

Karena saya memiliki file yang ter-enkripsi, saya perlu melakukan dekripsi terlebih dahulu dengan menggunakan perintah seperti berikut ini:

> <strong>$</strong> <code>kpt fn eval --image gcr.io/kpt-fn-contrib/sops:v0.3.0 --env SOPS_IMPORT_PGP="$PRIVATE_KEY" \</code><br>
> <code>--include-meta-resources --fn-config kubernetes/decrypt.yaml kubernetes</code>

Pada perintah di atas, saya mengasumsikan bahwa isi *private key* sudah disimpan ke sebuah *environment variable* dengan nama `PRIVATE_KEY`.  Setelah itu, saya men-*render* file *manifest* dengan memberikan perintah:

> <strong>$</strong> <code>kpt fn render</code>

Dan sebagai langkah terakhir yang paling penting, saya akan menerapkan perubahan ke *cluster* Kubernetes dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kpt live apply</code>

```
installing inventory ResourceGroup CRD.
service/stock-item-service created
deployment.apps/stock-item-service created
statefulset.apps/keycloak created
statefulset.apps/keycloak-postgresql created
persistentvolumeclaim/mongodb-item-stock created
ingress.networking.k8s.io/ingress-web created
serviceaccount/keycloak created
rolebinding.rbac.authorization.k8s.io/rabbitmq-endpoint-reader created
service/keycloak-headless created
service/mongodb-item-stock created
deployment.apps/mongodb-item-stock created
...
39 resource(s) applied. 39 created, 0 unchanged, 0 configured, 0 failed
```

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Bila perintah di atas gagal dengan pesan kesalahan seperti "Error from server (NotFound): the server could not find the requested resource (post resourcegroups.kpt.dev)", saya dapat memberikan perintah <code>kpt live install-resource-group</code> untuk membuat  <code>ResourceGroup</code> yang dibutuhkan secara manual.
</div>

Saya dapat menggunakan `kpt live status` untuk melihat status *package*.  Dan seperti biasanya, saya juga dapat menggunakan perintah `kubectl` untuk berinteraksi dengan *resources* Kubernetes (seperti *pod*, *services*, *ingress* dan sebagainya) yang dibuat.  Proyek ini belum sepenuhnya mengikuti GitOps karena ada beberapa hal yang masih harus dilakukan secara manual di Kubernetes.  Sebagai contoh, saya harus menginstall *ingress controller* karena sebelumnya saya menggunakan `minikube addons enable ingress` di minikube.  Sebagai alternatif yang lebih baik, saya sebaiknya men-install *ingress controller* melalui Helm.  Selain itu, saya juga perlu mendaftarkan realm baru di Keycloak dengan nama `Latihan`, membuat *client* dengan nama `latihan-k8s`, dan membuat *user* baru sehingga pengguna nantinya bisa *login* di aplikasi web.  Namun, ini sepertinya lebih ke arah aplikasi dan bukan lagi infrastruktur.

Bagaimana bila ada perubahan di *repository* Git?  Sebagai contoh, anggap saja saya memutuskan untuk menghilangkan *dependency* ke Keycloak dengan menghapus folder `keycloak`, men-*push* perubahannya di *upstream* dan memberikan *tag* `kubernetes/v0.0.2` ke *commit* tersebut.  Untuk mengaplikasikan perubahan tersebut di lokal, saya akan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>kpt pkg update kubernetes@v0.0.2 --strategy=force-delete-replace</code>

Saya menggunakan nilai `force-delete-replace` karena saya tidak akan pernah melakukan perubahan di lokal.  Semua perubahan harus datang dari *upstream* (yang sudah disetujui terlebih dahulu sebelum di-*merge* ke *repository*).

Saya kemudian melakukan proses dekripsi file Secret, men-*render* file *manifest* dan akhirnya melakukan `live apply` untuk mengaplikasikan perubahan ke *cluster* Kubernetes, seperti yang ditunjukkan pada perintah berikut ini:

> <strong>$</strong> <code>kpt fn eval --image gcr.io/kpt-fn-contrib/sops:v0.3.0 --env SOPS_IMPORT_PGP="$PRIVATE_KEY" --include-meta-resources --fn-config kubernetes/decrypt.yaml kubernetes</code>

> <strong>$</strong> <code>kpt fn render</code>

> <strong>$</strong> <code>kpt live apply</code>

```
...
28 resource(s) applied. 1 created, 18 unchanged, 9 configured, 0 failed
statefulset.apps/keycloak-postgresql pruned
statefulset.apps/keycloak pruned
service/keycloak-headless pruned
service/keycloak pruned
secret/keycloak-postgresql pruned
secret/keycloak pruned
serviceaccount/keycloak pruned
ingress.networking.k8s.io/keycloak pruned
service/keycloak-postgresql-headless pruned
service/keycloak-postgresql pruned
configmap/keycloak-env-vars pruned
11 resource(s) pruned, 0 skipped, 0 failed
```

Pada saat `kpt live apply` dikerjakan, terlihat bahwa *resource* yang sudah dihapus dari *upstream* juga secara otomatis akan di-hapus di *cluster* Kubernetes.

Untuk menghapus seluruh *resource* yang ada, saya dapat memberikan perintah seperti:

> <strong>$</strong> <code>kpt live destroy</code>

Sampai disini, bila saya mengulangi langkah-langkah di atas pada *server* lain (misalnya *server* untuk *testing* dan *server* untuk *production*), saya tetap akan memperoleh hasil yang konsisten asalkan mereka dijalankan berdasarkan *repository* Git yang sama.