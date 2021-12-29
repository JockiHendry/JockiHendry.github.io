---
layout: post
category: DevOps
title: Memakai GitHub Actions dan Github Packages Untuk Mengelola Image Docker
tags: [Docker, Kubernetes]
---

Salah satu tugas yang umum dilakukan oleh DevOps *engineer* adalah mengotomatisasikan proses *building* kode program yang dibuat oleh programmer.  Misalnya, saat ada *commit* baru di *branch* `master`, Continuous Integration (CI) platform seperti Jenkins akan bekerja menghasilkan *artifact* yang dibuat dari kode program terbaru (misalnya file Jar/War untuk aplikasi Java, Python modules untuk aplikasi Python, dan sebagainya).  Khusus untuk aplikasi yang dijalankan di *cluster* Kubernetes, *artifact* yang dihasilkan adalah sebuah *image* Docker yang biasanya dibuat berdasarkan isi file `Dockerfile`.  Pada tulisan ini, saya akan mencoba menggunakan [Github Actions](https://docs.github.com/en/actions) sebagai CI platform untuk menghasilkan *image* Docker dan mempublikasikannya di [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) sehingga dapat saya pakai di *cluster* Kubernetes nantinya.  Kedua fitur tersebut dapat dipakai tanpa biaya dengan batas eksekusi 2.000 menit untuk GitHub Actions dan penyimpanan 500 MB untuk Github Packages.

Pada [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/089d0faab5f2bf074a469156925709aa50bae68c), saya memiliki dua *service* berbeda di folder `stock-item-service` dan folder `web`.  Tujuan akhir yang ingin saya capai adalah setiap kali terdapat perubahan di *branch* `main` di folder `stock-item-service`, sebuah *image* Docker terbaru dengan nama `JockiHendry/latihan-k8s-stock-item-service:edge` akan dipublikasikan di GitHub Container registry.  Begitu juga perubahan di folder `web` yang harus membuat *image* Docker baru dengan nama `JockiHendry/latihan-k8s-web:edge`.

Saya akan mulai dengan folder [web](https://github.com/JockiHendry/latihan-k8s/tree/089d0faab5f2bf074a469156925709aa50bae68c/web) karena sudah terdapat sebuah [Dockerfile](https://github.com/JockiHendry/latihan-k8s/blob/089d0faab5f2bf074a469156925709aa50bae68c/web/Dockerfile) di folder ini. Karena nantinya akan ada banyak service yang menggunakan Dockerfile, saya akan membuat sebuah *workflow* khusus untuk men-*build* dan mempublikasikan *image* berdasarkan Dockerfile.  *Workflow* ini nantinya dapat dipanggil oleh *workflow* yang membutuhkannya.  Sebagai contoh, saya membuat sebuah file baru dengan nama `build-push.yaml` di folder `.github/workflows` dengan isi seperti berikut ini:

```yaml
on:
  workflow_call:
    inputs:
      registry:
        required: true
        type: string
      imageName:
        required: true
        type: string
      directory:
        required: true
        type: string

jobs:
  build-image:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2
      - name: Login to Container registry
        uses: docker/login-action@v1.12.0
        with:
          registry: {% raw %}${{ inputs.registry }}{% endraw %}
          username: {% raw %}${{ github.actor }}{% endraw %}
          password: {% raw %}${{ secrets.GITHUB_TOKEN }}{% endraw %}
      - name: Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v3.6.2
        with:
          images: {% raw %}${{ inputs.registry }}/${{ inputs.imageName }}{% endraw %}
          tags: |
            type=edge,branch=main
      - name: Build and push
        uses: docker/build-push-action@v2.7.0
        with:
          context: {% raw %}./${{ inputs.directory }}{% endraw %}
          push: true
          tags: {% raw %}${{ steps.meta.outputs.tags }}{% endraw %}
          labels: {% raw %}${{ steps.meta.outputs.labels }}{% endraw %}
```

*Workflow* ini membutuhkan masukan berupa `registry`, `imageName`, dan `directory`.  Nilai `registry` harus berupa `ghcr.io` bila *image* akan disimpan di Github Packages atau `registry.hub.docker.com` bila disimpan di Docker Hub.  Sebenarnya Docker Hub juga menyediakan paket tanpa biaya untuk *public repository*, bahkan tanpa batasan ukuran, hanya batas 200 operasi *pull* setiap 6 jam.  Pada tulisan ini, saya akan menggunakan Github Packages supaya saya tidak perlu membuat akun baru lagi dan dapat menggunakan `secrets.GITHUB_TOKEN` yang sudah disediakan oleh Github Actions.

Pada *workflow* di atas, saya menggunakan [docker/metadata-action](https://github.com/docker/metadata-action) untuk menghasilkan `tags` dan `labels` yang dapat saya pakai untuk *image* yang dibuat.  Ada beberapa jenis `tags` yang dapat dihasilkan oleh *action* ini, misalnya berdasarkan nama *branch* dan *tag*.  Jika ingin *tag* berdasarkan waktu eksekusi, saya dapat menggunakan nilai `tags` seperti {% raw %}<code>type=raw,value=main-{{date 'YYYYMMDDHHmm'}}</code>{% endraw %}.  Yang saya pakai di atas adalah `type=edge` sehingga nantinya saya bisa men-*pull* *image* dengan menggunakan nama seperti `JockiHendry/latihan-k8s-angular-web:edge`.  Proses eksekusi *building* berdasarkan Dockerfile dan *pushing* ke Github Packages yang sesungguhnya baru terjadi saat memanggil [docker/build-push-action](https://github.com/docker/build-push-action) di langkah terakhir.

Untuk memakai *workflow* di atas, saya membuat file baru dengan nama `web.yaml` di folder yang sama dengan isi seperti berikut ini:

```yaml
name: angular-web-service
on:
  push:
    branches:
      - main
    paths:
      - web/**
  workflow_dispatch:

jobs:
  build-and-push-image:
    uses: JockiHendry/latihan-k8s/.github/workflows/build-push.yaml@main
    with:
      registry: ghcr.io
      imageName: JockiHendry/latihan-k8s-angular-web
      directory: web
```

Pada key `on`, saya menggunakan nilai `push` dengan `branches` dan `paths` yang menunjukkan bahwa konfigurasi ini akan dikerjakan jika terdapat *commit* baru ke *branch* `main` dan *commit* tersebut mengandung perubahan di folder `web`.  Selain itu, saya juga menambahkan `workflow_dispatch` di `on` sehingga *workflow* ini bisa dijalankan secara manual.  Dengan `workflow_dispatch`, akan muncul tombol **Run workflow** saat membuka tab Actions di halaman GitHub untuk mengerjakan *workflow* tersebut seperti yang terlihat pada gambar berikut ini:

![Tab Actions Di GitHub]({{ "/assets/images/gambar_00062.png" | relative_url}}){:class="img-fluid rounded"}

Hal ini sangat berguna dalam pengujian *workflow*.  Saat saya menemukan kesalahan di deklarasi YAML untuk *workflow* dan memperbaikinya, *workflow* tidak akan otomatis dikerjakan.  Saya perlu melakukan perubahan di folder *web* dan membuat *commit* yang seharusnya tidak perlu ada untuk memicu eksekusi ulang bila seandainya tidak ada `workflow_dispatch`. 

Setelah *workflow* selesai dikerjakan, saya dapat mengakses *image* Docker yang dihasilkannya dari komputer lain dengan menggunakan perintah seperti:

> <strong>$</strong> <code>docker pull ghcr.io/jockihendry/latihan-k8s-angular-web:edge</code>

Selain itu, bila saya membuka tab Packages di halaman profil GitHub saya, saya dapat men-klik *image* yang dihasilkan untuk mendapatkan informasi seperti yang terlihat pada gambar berikut ini:

![Tampilan Di GitHub Packages]({{ "/assets/images/gambar_00063.png" | relative_url}}){:class="img-fluid rounded"}

Berikutnya saya akan membuat *image* Docker untuk folder [stock-item-service](https://github.com/JockiHendry/latihan-k8s/tree/089d0faab5f2bf074a469156925709aa50bae68c/stock-item-service).  Ini adalah proyek Spring Boot yang tidak memiliki `Dockerfile`.  Sebagai gantinya, *image* Docker dihasilkan secara otomatis melalui *task* Gradle bernama `bootBuildImage`.  Saya perlu melakukan sedikit perubahan di file [build.gradle](https://github.com/JockiHendry/latihan-k8s/blob/089d0faab5f2bf074a469156925709aa50bae68c/stock-item-service/build.gradle) supaya menyertakan informasi *registry* Docker Packages seperti yang terlihat pada:

```yaml
...
bootBuildImage {
  imageName = "stock-item-service"
  docker {
    publishRegistry {
      username = registryUsername
      password = registryPassword
      url = 'https://ghcr.io'
    }
  }
}
...
```

Saya tidak ingin menyertakan informasi seperti password di file ini karena file ini dapat dilihat siapa saja.  Oleh sebab itu, saya menggunakan variabel `registryUsername` dan `registryPassword` di deklarasi *task* Gradle di atas.  Nilai kedua variabel ini nantinya dapat saya sertakan saat memanggil Gradle dengan menggunakan parameter `-P`.  Untuk itu, saya membuat file `.github/workflows/stock-item-service.yaml` dengan isi yang terlihat seperti berikut ini:

```yaml
name: stock-item-service
on:
  push:
    branches:
      - main
    paths:
      - stock-item-service/**
  workflow_dispatch:

env:
  REGISTRY: ghcr.io

jobs:
  build-image:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2
      - name: Setup Java
        uses: actions/setup-java@v2
        with:
          java-version: '17'
          distribution: temurin
          cache: gradle
      - name: Validate Gradle wrapper
        uses: gradle/wrapper-validation-action@v1
      - name: Build and push
        working-directory: ./stock-item-service
        run: |
          ./gradlew bootBuildImage \
          -PregistryUsername={% raw %}${{ github.actor }}{% endraw %} -PregistryPassword={% raw %}${{ secrets.GITHUB_TOKEN }}{% endraw %} \
          --imageName={% raw %}${{ env.REGISTRY }}{% endraw %}/jockihendry/latihan-k8s-stock-item-service:edge \
          --publishImage
```

Pada *workflow* di atas, saya menggunakan OpenJDK 17 dari [Eclipse Temurin](https://adoptium.net) untuk melakukan proses *building* kode program Spring Boot tersebut.  Pada langkah terakhir, saya memanggil `./gradlew bootBuildImage` untuk men-*build* dan sekaligus mempublikasikan *image* hasil *build* ke GitHub Packages.  Disini saya menngisi variabel `registryUsername`, `registryPassword`, dan juga menentukan nama *image* secara lengkap beserta dengan *tag*-nya.  Satu hal yang menarik disini adalah walaupun saya menyertakan *password* seperti `-PregistryPassword={% raw %}${{ secrets.GITHUB_TOKEN }}{% endraw %}`, di hasil eksekusi Github Actions, *password* tersebut secara otomatis di-*masking* seperti yang terlihat pada gambar berikut ini:

![Password masking di Github Actions]({{ "/assets/images/gambar_00064.png" | relative_url}}){:class="img-fluid rounded"}

Ini adalah fitur yang meningkatkan keamanan sehingga tidak ada kebocoran *password*, bahkan saya sendiri tidak tahu apa *password* yang dipakai.  Walaupun demikian, saya tetap perlu berhati-hati bila menyetel *password* ini sebagai *environment variable* atau melewatkannya ke *action* yang tidak dikenal.

Sampai disini, saya dapat melihat semua eksekusi GitHub Actions di <https://github.com/JockiHendry/latihan-k8s/actions>.  Bila ada proses *build* yang gagal, saya dapat segera mengetahuinya dan memperbaikinya.  Selain itu, saya juga bisa menggunakan badge seperti [![angular-web-service](https://github.com/JockiHendry/latihan-k8s/actions/workflows/web.yaml/badge.svg?branch=main)](https://github.com/JockiHendry/latihan-k8s/actions/workflows/web.yaml) dan [![stock-item-service](https://github.com/JockiHendry/latihan-k8s/actions/workflows/stock-item-service.yaml/badge.svg?branch=main)](https://github.com/JockiHendry/latihan-k8s/actions/workflows/stock-item-service.yaml) untuk memperoleh informasi *build* tanpa harus masuk ke halaman tersebut.

Untuk melihat daftar *image* Docker yang sudah dibuat, saya dapat membuka tab [Packages](https://github.com/JockiHendry?tab=packages) dari halaman profil.  Bila saya men-klik salah satu *image*, maka informasi untuk memakainya melalui perintah `docker` beserta daftar riwayat *tag*-nya akan muncul.  Namun, bagaimana bila saya ingin menggunakannya di file *manifest* Kubernetes?  Karena saya menggunakan *repository* publik yang dapat diakses siapa saja, saya cukup mengubah `image` dari format seperti `angular-web:latest` menjadi seperti `ghcr.io/jockihendry/latihan-k8s-angular-web:edge` seperti yang terlihat pada baris berikut ini:

```yaml
...
spec:
      containers:
        - name: angular-web
          image: ghcr.io/jockihendry/latihan-k8s-angular-web:edge
          imagePullPolicy: Always
...
```

Bila sebelumnya saya menggunakan nilai `Never` untuk `imagePullPolicy`, saya perlu menghapus baris tersebut atau setidaknya mengubahnya menjadi `Always` supaya Kubernetes mau mengambil *image* dari luar.   Untuk *image* di GitHub Packages yang dipublikasikan dari *repository* *private*, saya perlu menggunakan `<imagePullSecrets>` seperti yang tertera pada panduan di <https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/>.
