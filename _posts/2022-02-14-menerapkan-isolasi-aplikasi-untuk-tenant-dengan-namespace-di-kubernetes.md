---
layout: post
category: DevOps
title: Menerapkan Isolasi Aplikasi Untuk Tenant Dengan Namespace Di Kubernetes
tags: [Kubernetes]
---

Pada suatu hari, anggap saja ada dua perusahaan fiktif dengan nama `perusahaan1` dan `perusahaan2` yang ingin memakai aplikasi [latihan-k8s](https://github.com/JockiHendry/latihan-k8s).  Mereka selanjutnya akan disebut sebagai *tenant*.  Setiap *tenant* akan mendaftarkan beberapa *user* dengan hak akses berbeda.  Tentu saja mereka juga tidak ingin data mereka diakses oleh *tenant* lain.  Salah satu solusi yang umum ditempuh untuk hal ini adalah dengan menerapkan *multitenancy* pada aplikasi.  Ini bisa jadi membutuhkan perubahan cukup besar pada kode program bila tidak didukung dari awal pada saat dirancang.  Selain itu, bila masing-masing *tenant* menginginkan fitur yang bertolak belakang di kemudian hari, akan cukup sulit mengelolanya di satu program yang sama.  Sebagai alternatif *multitenancy*, saya akan mencoba menggunakan fitur *namespace* di Kubernetes untuk men-*deploy* aplikasi yang sama dengan URL berbeda yang sama sekali tidak berhubungan satu sama lainnya.  Penerapan GitOps akan membantu mempermudah proses inisialisasi *namespace* untuk *tenant*.

Fitur *namespace* di Kubernetes memungkinkan saya untuk men-*deploy* *resource* dengan nama yang sama tanpa takut terjadi konflik.  Walaupun demikian, tidak seluruh *resource* Kubernetes dipisahkan oleh *namespace*.  Sebagai contoh, PersistentVolume berlaku secara global di *cluster* sementara PersistentVolumeClaim bersifat unik di setiap *namespace*.  Bila ingin mengelola PersistentVolume secara GitOps, saya perlu membuat *repository* Git baru terpisah untuk mewakili PersistentVolume tersebut.  Namun, sebagai latihan, saya cukup menghapus seluruh deklarasi PersistentVolume yang ada.  Hal ini karena Kubernetes akan mencoba membuat PersistentVolume baru untuk memenuhi apa yang dibutuhkan oleh PersistenceVolumeClaim.

Untuk mengakses aplikasi, idealnya setiap *tenant* dapat menggunakan *subdomain* seperti https://web.perusahaan1.latihan.jocki.me, https://web.perusahaan2.latihan.jocki.me, dan seterusnya.  Namun ini berarti saya perlu melakukan *provisioning* sertifikat TLS baru setiap kali membuat *tenant* baru.  Agar lebih sederhana, sebagai latihan, saya akan menggunakan URL seperti https://web-perusahaan1.latihan.jocki.me, https://web-perusahaan2.latihan.jocki.me, dan seterusnya.  Untuk itu, saya bisa menambahkan setter Kpt dengan nama `tenant` untuk setiap URL yang ada di file konfigurasi, seperti yang terlihat pada contoh berikut ini:

```yaml
'https://web-default.latihan.jocki.me' # kpt-set: https://web-${tenant}.${domain}
```

Selain itu, akan lebih baik bila saya melakukan instalasi Kong Ingress Controller pada *namespace* tersendiri (terpisah dari aplikasi).  Karena *manifest* instalasi Kong Ingress Controller secara *default* akan membuat *namespace* dengan `kong` dan melakukan instalasi ke *namespace* tersebut, saya cukup memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>kubectl apply -f https://raw.githubusercontent.com/Kong/kubernetes-ingress-controller/main/deploy/single/all-in-one-dbless.yaml</code>

Agar lebih mudah dalam pembuatan dan inisialisasi *tenant* baru, saya akan membuat sebuah Bash script dengan nama `create-tenant.sh` dengan isi seperti berikut ini:

```shell
#!/usr/bin/env bash
mkdir tenant-$1
cd tenant-$1
kubectl create namespace tenant-$1
git init
kpt pkg init
kpt live init --namespace tenant-$1
kpt pkg get https://github.com/JockiHendry/latihan-k8s.git/kubernetes@v0.0.4
kpt fn eval --image gcr.io/kpt-fn-contrib/sops:v0.3.0 --env SOPS_IMPORT_PGP="$(gpg --armor --export-secret-keys FFA6D9C42D878F5C)" \
  --include-meta-resources --fn-config kubernetes/decrypt.yaml kubernetes
rm kubernetes/kong/kong.yaml  
kpt fn render
kpt fn eval --image gcr.io/kpt-fn/starlark:v0.3.0 --fn-config kubernetes/setup-dev.yaml
kpt fn eval --image gcr.io/kpt-fn/apply-setters:v0.2.0 -- domain=latihan.jocki.me tenant=$1
kpt fn eval kubernetes --image gcr.io/kpt-fn/set-namespace:v0.2.0 -- namespace=tenant-$1
kpt live install-resource-group 
kpt live apply
kpt fn eval --image gcr.io/kpt-fn/starlark:v0.3.0 --network --fn-config kubernetes/kong/refresh-jwt-secret.yaml
kpt live apply --reconcile-timeout=1m
git add .
git commit -m "First commit"
```

Sekarang, untuk menyiapkan aplikasi untuk *tenant* baru, saya cukup mengerjakan script di atas seperti pada contoh berikut ini:

> <strong>$</strong> <code>./create-tenant.sh perusahaan1</code>

> <strong>$</strong> <code>./create-tenant.sh perusahaan2</code> 

Script di atas akan membuat dua folder baru, `tenant-perusahaan1` dan `tenant-perusahaan2`, dimana masing-masing merupakan repository Git yang mewakili isi *namespace* `tenant-perusahaan1` dan `tenant-perusahaan2`:

<div class="diagram">
. deployment
├── tenant-perusahaan1  
│   ├── .git
│   └── kubernetes
│       └── ... (manifest k8s)
├── tenant-perusahaan2  
│   ├── .git
│   └── kubernetes
│       └── ... (manifest k8s)
└── create-tenant.sh
</div>

Bagian yang paling penting dari script di atas adalah `kpt live apply` yang akan melakukan sinkronisasi *manifest* Kubernetes di folder milik *tenant* dengan *resources* Kubernetes yang ada di *namespace* untuk *tenant* tersebut.  Untuk kasus yang lebih realistis, script ini dapat dipicu oleh sebuah halaman registrasi dimana setelah *tenant* mendaftarkan dirinya, ia akan memperoleh sebuah URL untuk mengakses aplikasi.

Bila saya membuka halaman https://web-perusahaan1.latihan.jocki.me dan https://web-perusahaan2.latihan.jocki.me, saya akan menemukan bahwa walaupun mereka dibuat berdasarkan kode program yang sama, isi database-nya berbeda sehingga perubahan pada halaman yang satu tidak akan mempengaruhi halaman lainnya, seperti yang diperlihatkan pada gambar berikut ini:

![Dua Tenant Yang Berbeda]({{ "/assets/images/gambar_00071.png" | relative_url}}){:class="img-fluid rounded"}

Bukan hanya itu, karena Keycloak dijalankan secara terpisah di masing-masing *namespace* milik *tenant*, kedua *tenant* juga dapat mendaftarkan pengguna mereka tanpa mempengaruhi pengguna milik *tenant* lainnya seperti yang diperlihatkan pada gambar berikut ini:

![Keycloak Di Dua Tenant Yang Berbeda]({{ "/assets/images/gambar_00072.png" | relative_url}}){:class="img-fluid rounded"}

Bagaimana bila ada perubahan terbaru dari aplikasi?  Sebagai contoh, anggap saja v0.0.5 dari aplikasi sudah diluncurkan.  Cara yang paling aman adalah melakukan update secara manual, misalnya melakukan *canary release* dengan memilih *tenant* secara acak yang mendapatkan *update*.   Kelebihannya adalah bila terjadi kesalahan fatal pada versi terbaru, hal tersebut tidak akan langsung mempengaruhi seluruh *tenant*.  Untuk men-*update* versi aplikasi yang dipakai *tenant* tertentu, saya dapat memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>cd tenant-perusahaan1</code>

> <strong>$</strong> <code>kpt pkg update kubernetes@v0.0.5</code>

Di GitOps, setiap perubahan pada infrastruktur harus diwakili oleh sebuah *commit* sehingga perubahan selalu terdokumentasikan di riwayat Git.  Oleh sebab itu, saya kemudian memberikan perintah berikut ini:

> <strong>$</strong> <code>git add .</code> 

> <strong>$</strong> <code>git commit -m "Update to v0.0.5"</code>
 
> <strong>$</strong> <code>kpt live apply</code>

Merasa perubahan secara manual satu per satu terlalu repot dan ingin langsung men-*update* seluruh *tenant* yang ada sekaligus?  Saya bisa membuat script untuk mengotomatisasikan proses di atas ke seluruh folder *tenant* yang ada seperti pada contoh berikut ini:

```shell
#!/usr/bin/env bash
for d in tenant-*/ ; do
  pushd .
  cd $d
  kpt pkg update kubernetes@v0.0.5
  kpt live apply
  git add .
  git commit -m "Update to v0.0.5"
  popd
done
```

Untuk melihat perubahan terakhir pada infrastruktur *tenant*, saya dapat menggunakan `git log` seperti pada contoh berikut ini:

> <strong>$</strong> <code>find . -type d -name "tenant-*" -print -execdir git -C $PWD/{} log -n1 --oneline \;</code>

```
./tenant-perusahaan2
8fec686 (HEAD -> master) Update to v0.0.5
./tenant-perusahaan1
5fa2736 (HEAD -> master) Update to v0.0.5
```

Bila suatu hari nanti *tenant* `perusahaan1` memiliki lonjakan jumlah pengguna dan bersedia mengambil paket dengan kinerja tinggi, saya dapat meningkatkan jumlah *pod* untuk *tenant* tersebut dengan perintah seperti:

> <strong>$</strong> <code>cd tenant-perusahaan1</code>

> <strong>$</strong> <code>kpt fn eval --image gcr.io/kpt-fn/search-replace:v0.2.0 -- by-path='spec.replicas' put-value=10</code>

> <strong>$</strong> <code>kpt live apply</code>

> <strong>$</strong> <code>git add .</code>

> <strong>$</strong> <code>git commit -m "Increase number of pods"</code>

Perubahan di atas hanya berlaku untuk *tenant1* dan tidak akan mempengaruhi *tenant* lainnya.  Untuk membuktikannya, saya dapat memberikan perintah berikut ini untuk melihat jumlah *pod* di setiap *namespace* yang ada:

> <strong>$</strong> <code>kubectl get replicaset --all-namespaces</code>

```
NAMESPACE              NAME                                  DESIRED   CURRENT   READY   AGE
tenant-perusahaan1     angular-web-7d949b6fff                10        10        10      127m
tenant-perusahaan1     mongodb-item-stock-55886dcb68         10        10        10      127m
tenant-perusahaan1     stock-item-service-75cf6f8bc7         10        10        10      126m
tenant-perusahaan2     angular-web-7d949b6fff                1         1         1       123m
tenant-perusahaan2     mongodb-item-stock-55886dcb68         1         1         1       123m
tenant-perusahaan2     stock-item-service-644ddff896         1         1         1       122m
...
```