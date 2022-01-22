---
layout: post
category: DevOps
title: Melakukan Validasi JWT Melalui Kong Ingress Controller
tags: [Kubernetes]
---

Pada [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/a0493f9b3354d68be87ef34c386e46c73991b078), saya menangani *authentication* di aplikasi Spring Boot dengan menggunakan Spring Security.  Saya kemudian membuat service baru, sebuah aplikasi Python, di [artikel sebelumnya]({% post_url 2021-12-17-pengalamatan-pod-dan-service-di-kubernetes %}).  Salah satu masalah keamanan pada service baru tersebut adalah *endpoint*-nya tidak melakukan validasi JWT sehingga bisa diakses oleh siapa saja.  Saya bisa saja menggunakan library seperty PyJWT untuk menambahkan validasi JWT.  Namun, daripada setiap kali membuat service baru harus menangani JWT, akan lebih elegan bila validasi JWT dapat langsung dilakukan dari Ingress Controller.  Kelebihannya adalah saya dapat melakukan konfigurasi di satu tempat yang sama tanpa harus mengubah kode program aplikasi (misalnya untuk mematikan *authentication*, cukup mengubah Ingress controller).  

Di artikel ["Memakai Ingress Controller"]({% post_url 2021-12-19-memakai-ingress-controller-di-kubernetes %}), saya sudah menggunakan `ingress-nginx` sebagai Ingress Controller.  Ia sangat mudah dipakai di minikube karena tersedia sebagai addon.  Namun sayangnya, `ingress-nginx` masih belum mendukung validasi JWT saat artikel ini ditulis.  Sebagai perbandingan, salah satu pesaing NGINX, [Envoy](https://www.envoyproxy.io/) sudah mendukung validasi JWT.  Terdapat lumayan banyak Ingress Controller berbasis Envoy seperti Istio, Ambassador dan sebagainya.  Namun, pada artikel ini, saya akan memakai [Kong Ingress Controller](https://github.com/Kong/kubernetes-ingress-controller) yang juga mendukung validasi JWT.  Kong Ingress Controller pada dasarnya akan memakai [Kong API Gateway](https://github.com/Kong/kong) yang berbasis NGINX.

Apa beda Ingress Controller dan API Gateway? Bila dilihat dari perannya, mereka sangat berbeda dan tidak dapat dibandingkan secara langsung.  Ingress adalah sebuah fasilitas untuk mendeklarasikan *gateway* dalam bentuk *resource* yang dikelola oleh Kubernetes.  Salah satu tujuan utamanya adalah pengguna tidak perlu melakukan perubahan file konfigurasi secara langsung pada NGINX atau Envoy yang dipakai oleh Ingress Controller.  Sebagai contoh, saya dapat mengaktifkan HTTPS cukup dengan menambahkan `tls.hosts` dan `tls.secretName` di *resource* Ingress.  Bila melakukan perubahan ini secara langsung di NGINX, saya perlu meng-*edit* file `nginx.conf` dan menambahkan pengaturan seperti `ssl_certificate`, `ssl_certificate_key`, dan sebagainya.  Bukan hanya itu, bila beralih ke Envoy, struktur fike konfigurasinya tentu berbeda lagi.

<div class="alert alert-info" role="alert">
Secara ideal, pengaturan untuk Ingress Controller dapat didefinisikan di Ingress dimana pengaturan yang "tidak standar" dapat dilewatkan dalam bentuk <em>annotations</em> seperti yang dilakukan oleh <code>ingress-nginx</code>.  Namun, kebanyakan penyedia Ingress Controller merasa ini terbatas dan menawarkan konfigurasi dalam bentuk Custom Resource Definition (CRD).  Isi dan format CRD ini berbeda-beda tergantung dari Ingress Controller yang dipakai.
</div>

Kubernetes sendiri tidak mengatur apa yang harus Ingress Controller lakukan selain melakukan *routing*!  Implementasi Ingress Controller juga bebas asalkan ia dapat mengerjakan apa yang tertera di Ingress.  Pada umumnya, implementasi Ingress Controller berupa *reverse proxy* dan *load-balancer* seperti pada `ingress-nginx` dan Istio Kubernetes Ingress.  Ada juga implementasi Ingress Controller yang menawarkan fitur API Gateway seperti Kong Ingress Controller, Ambassador Ingress Controller, dan sebagainya.  Selain itu, ada juga implementasi Ingress Controller yang mendukung *service mesh* seperti Kuma dan Service Mesh Hub.  

Istilah API gateway sendiri lebih merupakan istilah pemasaran, bukan sebuah spesifikasi baku yang diatur dan diawasi oleh badan tertentu (bandingkan dengan spesifikasi jaringan yang dikelola di RFC IETF atau spesifikasi HTML5 yang selalu sama di browser manapun).  Dengan demikian, setiap produk API Gateway bisa menawarkan fasilitas yang bervariasi.  Secara umum, API gateway menawarkan fitur seperti *routing*, *rate limiting*, validasi JWT, dokumentasi OpenAPI, dan sebagainya.  `ingress-nginx` juga mendukung *rate limiting* dengan *annotation* seperti `nginx.ingress.kubernetes.io/limit-rate`, namun karena lebih bekerja untuk mendukung jaringan (bukan condong untuk mendukung aplikasi), ia tidak disebut API Gateway.   

Untuk melakukan instalasi Kong Ingress Controller, saya dapat memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl apply -f https://raw.githubusercontent.com/Kong/kubernetes-ingress-controller/main/deploy/single/all-in-one-dbless.yaml</code>

<div class="alert alert-info" role="alert">
<p>
<strong>TIPS:</strong> Bila ingin menerapkan GitOps, saya perlu men-download file <em>manifest</em> tersebut.  Saya kemudian dapat melakukan perubahan, misalnya, secara bawaan isi <em>manifest</em> tersebut akan membuat <em>namespace</em> baru dengan nama <code>kong</code>.  Saya bisa menghapus bagian ini dan mengganti <code>namespace: kong</code> menjadi <code>namespace: default</code> bila tidak ingin melakukan instalasi Kong Ingress Controller di <em>namespace</em> berbeda.
</p>
<div>
Selain itu, bila menjalankan aplikasi di minikube, akan lebih baik bila menambahkan <code>hostPort</code> sehingga port 80 dan port 443 dapat langsung diakses.  Karena ini bisa menimbulkan celah keamanan, saya tidak akan mengubahnya secara langsung di file <em>manifest</em>.  Sebagai alternatif yang lebih aman, saya bisa membuat Kpt mutator function, misalnya script Starlark (subset dari bahasa Python) yang dijalankan hanya saat memakai minikube seperti pada <a href="https://github.com/JockiHendry/latihan-k8s/blob/88fc4ecdd45976c4800b7be69c7432fd0aaf57ff/kubernetes/setup-dev.yaml">latihan-k8s/kubernetes/setup-dev.yaml</a>.
</div>
</div>
 
Langkah berikutnya, saya perlu mengubah `ingressClassName` di setiap *manifest* yang sebelumnya memiliki `nginx` menjadi `kong` seperti:

```yaml
...
spec:
  ingressClassName: kong
...
```

Nilai `metadata.annotations` yang diawali oleh `nginx.ingress.kubernetes.io` yang saya berikan untuk pengaturan CORS kini sudah tidak valid lagi karena tidak akan dimengerti oleh Kong Ingress Controller.  Sebagai alternatif-nya, Kong menggunakan CDR KongPlugin yang mewakili plugin Kong API Gateway.  Agar bisa mendapatkan fasilitas CORS kembali, saya akan memakai plugin [CORS](https://docs.konghq.com/hub/kong-inc/cors).  Untuk itu, saya membuat sebuah file *manifest* baru dengan nama `kong/cors-plugin.yaml` yang isinya terlihat seperti berikut ini:

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: app-cors-plugin
config:
  origins:
    - 'https://web.latihan.jocki.me' # kpt-set: https://web.${domain}
plugin: cors
```

Setelah itu, saya akan mengganti annotation `nginx.ingress.kubernetes.io` pada setiap Ingress yang perlu mendukung CORS menjadi seperti berikut ini:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-api
  annotations:
    konghq.com/plugins: kong-cors-plugin
...
```

Nilai `kong-cors-plugin` pada *annotation* `konghq.com/plugins` akan meng-asosiasi-kan plugin CORS dengan Ingress tersebut.  Setelah mengaplikasikan file yang berubah dengan `kubectl apply -f`, saya bisa memastikan *resource* KongPlugin sudah dibuat dengan memberikan perintah:

> <strong>$</strong> <code>kubectl get kongplugins</code>

Sekarang saatnya mengaktifkan dukungan validasi JWT.  Kong juga menyediakan fitur ini dalam bentuk plugin, [JWT](https://docs.konghq.com/hub/kong-inc/jwt).  Saya segera membuat file baru dengan nama `kong/jwt-plugin.yaml` dengan isi seperti berikut ini:

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: app-jwt-plugin
plugin: jwt
config:
  secret_is_base64: false
```

Spring Security mendukung *discovery* dari OpenID Connect (OIDC) dimana ia akan mendapatkan informasi yang dibutuhkan dengan mengakses URL seperti https://auth.latihan.jocki.me/auth/realms/latihan/.well-known/openid-configuration.  Dengan demikian, saya hampir tidak perlu menyediakan informasi seperti algoritma *signing* dan isi *public key* sama sekali.  Sayangnya, plugin JWT dari Kong tidak mendukung OIDC, sehingga saya perlu mengisi informasi yang dibutuhkan secara manual.  Sebagai contoh, saya membuat sebuah Secret baru dengan perintah seperti berikut ini:

> <strong>$</strong> <code>kubectl create secret generic app-jwt-secret \</code><br>
> <code>--from-literal=kongCredType=jwt \</code><br>
> <code>--from-literal=key="https://auth.latihan.jocki.me/auth/realms/latihan" \</code><br>
> <code>--from-literal=algorithm=RS256 \</code><br>
> <code>--from-literal=rsa_public_key="-----BEGIN PUBLIC KEY-----</code><br>
> <code>MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjEFj5A1c0N8j+wiY/sqJ1Lj4x/VXQ88DWI89WBMkFoat0e5TNg+YL1rYOdD3BsWV+REq4SzUxaY5w7zppvMF9c1ZmPyNk2T6mSPPeA8M5OPkGj4IfftNqCr13TQGUUT5O7CFkQoYsWhy1mB1WtefQbIiZQf6gWbqtv2o214Pxm3S8NQbHoamsoGBcTor1yqgBdrrhAxfl+aDmc2i/HwSvFzFSHTo+4HHnWcJgqVlmmxEiofoq4vFtxXOoWMuT/Oq+/ez24clRBDPfg5HRzX0ApsD4fT3G2IKXXennpW9mtE72b4ENpIf6Q+GS/RvYSVhE86kHZxIKAiD4h9AbI8sjQIDAQAB</code><br>
> <code>-----END PUBLIC KEY-----"</code>

Untuk mendapatkan nilai `rsa_public_key`, saya bisa membuka URL untuk *realm* yang dipakai di https://auth.latihan.jocki.me/auth/realms/latihan dan men-*copy* nilai `public_key` dari JSON yang ditampilkan di halaman tersebut.  Saya perlu memastikan untuk menambahkan `-----BEGIN PUBLIC KEY-----` dan `-----END PUBLIC KEY-----` karena plugin JWT dari Kong akan menolak *public key* tanpa baris tersebut.  

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> Bila menggunakan metode ini, setiap kali <em>public key</em> berubah seperti karena menjalankan ulang Keycloak atau melakukan rotasi <em>key</em>, Secret di atas harus dibuat ulang.  Untuk mempermudah proses ini, saya bisa membuat functions bila menggunakan kpt, atau melakukan sinkronisasi informasi tersebut melalui Kubernetes Operator.
</div>

Berikutnya, saya membuat sebuah KongConsumer dengan nama `web-consumer.yaml` yang isinya seperti berikut ini:

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: web
  annotations:
    kubernetes.io/ingress.class: kong
username: web
credentials:
  - app-jwt-secret
```

Nilai `username` pada file diatas tidak begitu berpengaruh untuk saat ini.  Yang penting adalah saya melakukan referensi ke Secret yang sebelumnya saya buat di `credentials` dan menambahkan *annotation* `kubernetes.io/ingress.class: kong` karena ingin menangani validasi JWT melalui Ingress.

Sebagai langkah terakhir, saya perlu menambahkan plugin `app-jwt-plugin` yang saya deklarasikan ke file *manifest* Ingress.  Sebagai contoh, pada file `ingress-api.yaml`, saya menambahkan *annotation* `konghq.com/plugins` seperti berikut ini:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-api
  annotations:
    konghq.com/plugins: 'app-cors-plugin, app-jwt-plugin'
    konghq.com/strip-path: 'true'
...
```

Konfigurasi di atas akan menyebabkan seluruh akses ke *path* di `ingress-api` harus menyertakan JWT yang valid.  Bila tidak ada JWT yang valid, pemanggil akan mendapatkan pesan kesalahan `{"message": "Unauthorized"}`.  Pesan ini dikembalikan oleh Kong Ingress Controller, bukan oleh aplikasi, sehingga Elasticsearch yang tidak aktif fitur *authentication*-nya pun ikut terlindungi.

Saya tetap bisa membuat *endpoint* yang boleh diakses tanpa validasi JWT.  Sebagai contoh, bila ingin file yang di-*upload* dapat dipakai secara bebas (asalkan tahu *link*-nya), saya cukup **tidak** menyertakan `app-jwt-plugin` pada nilai `konghq.com/plugins`.  Sebagai contoh, saya mengubah file `ingress-file-read.yaml` sehingga terlihat seperti pada contoh berikut ini:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-files-read
  annotations:
    konghq.com/plugins: app-cors-plugin
    konghq.com/strip-path: 'true'  
spec:
  ingressClassName: kong
  tls:
    - hosts:
        - files.latihan.jocki.me # kpt-set: files.${domain}
      secretName: tls-secret
  rules:
    - host: files.latihan.jocki.me # kpt-set: files.${domain}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: file-upload-service
                port:
                  number: 8080

```

Karena tidak ada `app-jwt-plugin` di file di atas, *path* pada Ingress tersebut dapat di-akses secara bebas.

Sementara itu, untuk *upload* file, karena ingin hanya user yang sudah login saja yang boleh meng-*upload* file, saya bisa membuat file `ingress-file-write.yaml` dengan isi seperti:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-files-write
  annotations:
    konghq.com/plugins: 'app-cors-plugin, app-jwt-plugin'  
spec:
  ingressClassName: kong
  tls:
    - hosts:
        - files.latihan.jocki.me # kpt-set: files.${domain}
      secretName: tls-secret
  rules:
    - host: files.latihan.jocki.me # kpt-set: files.${domain}
      http:
        paths:
          - path: /.*/upload
            pathType: Prefix
            backend:
              service:
                name: file-upload-service
                port:
                  number: 8080
```

Setelah mengaplikasikan seluruh file *manifest* yang saya ubah di atas, kini validasi JWT akan ditangani oleh Ingress Controller.  Saya boleh menghapus Spring Security dari aplikasi Spring Boot karena ia tidak dibutuhkan lagi.  Bila JWT tidak valid atau user belum login, *request* tidak akan pernah sampai di aplikasi.

Kelebihan lainnya adalah saat bekerja di setiap *service* dan menjalankan *service* di komputer lokal secara individual, saya tidak perlu mengkhawatirkan masalah *authentication* lagi.  Saya bisa memanggil *endpoint* selama *development* secara langsung tanpa perlu melewatkan JWT (selama aplikasi dijalankan di luar Kubernetes atau diakses tanpa melalui API Gateway).  Bila ingin mematikan validasi JWT secara global, juga bukanlah hal yang sulit karena bisa dilakukan dengan memodifikasi *manifest* Ingress dengan menghapus plugin `app-jwt-plugin` tanpa melakukan perubahan kode program di sisi aplikasi sama sekali.

Bila validasi JWT tidak bekerja sesuai dengan yang diharapkan, saya dapat memberikan perintah seperti berikut ini untuk melihat log pesan kesalahan dari Kong Ingress Controller:

> <strong>$</strong> <code>kubectl logs $(kubectl get pods -o name -l app=ingress-kong) -c ingress-controller</code>

*Pod* untuk Kong Ingress Controller terdiri atas dua *container*, `ingress-controller` dan `proxy`.  Saya dapat menggunakan `-c` untuk memilih log dari *container* mana yang hendak ditampilkan.