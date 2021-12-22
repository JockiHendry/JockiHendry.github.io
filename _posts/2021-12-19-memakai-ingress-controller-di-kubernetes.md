---
layout: post
category: DevOps
title: Memakai Ingress Controller Di Kubernetes
tags: [Kubernetes]
---

Pada [tulisan sebelumnya]({% post_url 2021-12-17-pengalamatan-pod-dan-service-di-kubernetes %}), saya menggunakan IP publik untuk mengakses *service* melalui *load balancer* eksternal dengan menggunakan tipe `LoadBalancer`.  Kali ini, saya akan mencoba menggunakan *ingress* untuk mendapatkan lebih banyak kendali lagi.  Seperti biasa, saya akan menggunakan minikube di komputer lokal.  Kubernetes tidak dilengkapi dengan *ingress controller* sehingga langkah pertama adalah memilih salah satu *ingress controller* yang hendak dipakai.  Kode program untuk *ingress controller* AWS, GCE dan NGINX secara resmi dikelola oleh tim Kubernetes; ada juga *ingress controller* lainnya dari pihak ketiga yang daftar selengkapnya dapat dijumpai di <https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/#additional-controllers>.  

Setiap *ingress controller* memiliki metode instalasi masing-masing (biasanya bisa dilakukan melalui Helm).  Di minikube, cara paling cepat untuk meng-*install* *ingress controller* adalah dengan memberikan perintah:

> <strong>$</strong> <code>minikube addons enable ingress</code>

Perintah di atas akan menambahkan *ingress controller*  NGINX ke *cluster* minikube saya.  Informasi lebih lanjut mengenai NGINX Ingress Controller dapat saya baca di <https://kubernetes.github.io/ingress-nginx>.  `ingress-nginx` ini adalah produk yang berbeda dari `nginx-ingress-controller` ([F5 NGINX Ingress Controller](https://nginx.com/products/nginx-ingress-controller)) walaupun namanya sama-sama mengandung NGINX.  `ingress-nginx` dikelola oleh tim Kubernetes sementara `nginx-ingress-controller` adalah produk berbayar dari NGINX (dilengkapi *free trial*).  Saya dapat melihat nama *ingress controller* yang barusan saya *install* dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl describe ingressClass nginx</code>

```
Name:         nginx
Labels:       app.kubernetes.io/component=controller
              app.kubernetes.io/instance=ingress-nginx
              app.kubernetes.io/name=ingress-nginx
Annotations:  ingressclass.kubernetes.io/is-default-class: true
Controller:   k8s.io/ingress-nginx
Events:       <none>
```

Terlihat bahwa nama *ingress controller*-nya adalah `k8s.io/ingress-nginx`.  Nilai `true` pada `is-default-class` menunjukkan bahwa bila terdapat *ingress resource* yang tidak mendefinisikan *ingressClassName*, *ingress resource* tersebut akan ditangani oleh *ingress controller* ini.  Untuk melihat informasi *ingress controller*-nya, saya dapat memberikan perintah:

> <strong>$</strong> <code>kubectl get service -n ingress-nginx ingress-nginx-controller</code>

```
NAME                       TYPE       CLUSTER-IP       EXTERNAL-IP   PORT(S)                      AGE
ingress-nginx-controller   NodePort   10.102.111.172   <none>        80:31685/TCP,443:31148/TCP   2m29s
```

Terlihat bahwa *ingress controller* ini menggunakan *service* dengan tipe `NodePort`.  Namun, bila menggunakan `NodePort`, bukankah itu berarti saya harus mengakses *ingress controller* ini melalui port seperti 31685 dan 31148?  Kenapa saya bisa mengakses *ingress controller* secara langsung lewat port 80 dan 443?  Ini karena *pod* yang dipakai oleh *ingress controller* menggunakan `hostPort` seperti yang terlihat pada:

> <strong>$</strong> <code>kubectl get pod -n=ingress-nginx -lapp.kubernetes.io/component=controller,app.kubernetes.io/instance=ingress-nginx,app.kubernetes.io/name=ingress-nginx -o=jsonpath='{.items[*].spec.containers[*].ports}'</code>

```
[
  {
    "containerPort": 80,
    "hostPort": 80,
    "name": "http",
    "protocol": "TCP"
  },
  {
    "containerPort": 443,
    "hostPort": 443,
    "name": "https",
    "protocol": "TCP"
  },
  {
    "containerPort": 8443,
    "name": "webhook",
    "protocol": "TCP"
  }
]
```

Penggunakan `hostPort` seperti di-atas menyebabkan *port* di-*bind* langsung ke jaringan *node* yang menjalankan *pod* tersebut.  Dengan demikian, saya bisa mengakses *ingress controller* melalui IP *node* di port 80, 443 dan 8443.  Bila *cluster* Kubernetes saya hanya terdiri atas satu *node*, maka nilai yang dikembalikan oleh `minikube ip` dapat dipakai (karena ini adalah satu-satunya *node*).  Akan tetapi, bila *cluster* memiliki lebih dari satu *node*, *pod* untuk *ingress controller* akan dikerjakan oleh satu satu *node* yang ada sehingga IP yang dipakai juga bisa berbeda tergantung IP *node* tersebut.  Agar tidak membingungkan, saya dapat mengubah *pod* milik *ingress controller* supaya selalu di-*deploy* di *master control plane* dengan memberikan perintah berikut:

> <strong>$</strong> <code>kubectl patch deployments -n ingress-nginx -p '{"spec":{"template":{"spec":{"nodeName":"minikube"}}}}' ingress-nginx-controller</code>

Nama *master control plane* selalu berupa `"minikube"` di minikube sehingga saya langsung mengisi `nodeName` dengan nama tersebut.  IP dari *node* ini adalah IP yang dikembalikan oleh perintah `minikube ip`.  Dengan demikian, saya dapat mengasosiasikan *domain* seperti `*.latihan.jocki.me` ke IP *node* tersebut tanpa perlu khawatir *ingress controller* sedang dijalankankan oleh *node* lain yang memiliki IP berbeda.

<div class="alert alert-warning" role="alert">
<strong>PERINGATAN:</strong> Cara ini tidak untuk dipakai di <em>production</em> karena bila <em>node</em> dengan nama <code>minikube</code> mengalami kerusakan, aplikasi tidak akan bisa diakses lagi.  
</div>

Pada lingkungan produksi, untuk meningkatkan kehandalan, konfigurasi jaringan yang disarankan adalah menggunakan sebuah *load balancer* (bisa berupa software atau hardware) di depan seluruh *node* yang ada seperti yang ditunjukkan pada diagram di <https://kubernetes.github.io/ingress-nginx/deploy/baremetal/#using-a-self-provisioned-edge>. *Load balancer* ini terhubung jaringan publik (Internet), tidak dikelola oleh Kubernetes, sementara seluruh *node* di Kubernetes berada dalam jaringan internal.  Karena *ingress controller* `ingress-nginx` menggunakan `NodePort`, saya dapat mengakses *pod*-nya melalui IP *node* apa saja.  Dengan demikian, saya hanya perlu mendaftarkan IP *node* ke *load balancer* eksternal yang ada.  Pengguna dari jaringan luar (Internet) tetap terhubung ke port 80 atau 443 di *load balancer* eksternal tersebut, yang kemudian akan meneruskan ke salah satu *node* di *node port* seperti 31685 dan 31148.  Bila salah satu *node* mengalami masalah, *load balancer* bisa mengarahkan *request* ke *node* lainnya.  Bila *pod* untuk *ingress controller* berada di *node* yang bermasalah, Kubernetes akan membuat ulang *pod* tersebut di *node* lain secara otomatis sehingga *request* tetap dapat ditangani.

Setelah instalasi *ingress controller* selesai, langkah berikutnya adalah mendefinisikan *ingress resource*.  Sebagai contoh saya membuat file *manifest* dengan nama `ingress.yaml` yang isinya terlihat seperti berikut ini:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
    - host: web.latihan.jocki.me
      http:
        paths:
          - pathType: Prefix
            path: /(.*)
            backend:
              service:
                name: web-service
                port:
                  number: 80
    - host: api.latihan.jocki.me
      http:
        paths:
          - path: /service1/(.*)
            pathType: Prefix
            backend:
              service:
                name: service1
                port:
                  number: 8080          
```

Pada file di atas, bagian yang berada di `spec` diatur oleh Kubernetes dan dokumentasinya dapat dibaca di <https://kubernetes.io/docs/concepts/services-networking/ingress/>.  Sementara itu, bagian `annotations` di `metadata`, dapat memiliki konfigurasi yang spesifik tergantung pada *ingress controller* yang dipakai.  Sebagai contoh, bila diawali dengan `nginx.ingress.kubernetes.io`, maka konfigurasi tersebut merupakan konfigurasi khusus untuk `ingress-nginx` yang daftar selengkapnya dapat dijumpai di <https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/>.

Nilai `ingressClassName` di konfigurasi di atas sebenarnya tidak perlu diberikan karena sudah terdapat *annotation* `ingressclass.kubernetes.io/is-default-class` dengan nilai `true` di *ingress class* sehingga `ingress-nginx` akan selalu dipakai (lagipula saya hanya meng-*install* satu jenis *ingress controller* saja pada artikel ini).

Berbeda dari *ingress controller* yang berada di *namespace* `ingress-nginx`, *ingress resource* harus berada di *namespace* yang sama dengan *backend* yang hendak diakses.  Pada contoh ini, saya meletakkan aplikasi saya di *default namespace*, sehingga untuk membuat *ingress resource* ini, saya cukup memberikan perintah:

> <strong>$</strong> <code>kubectl apply -f ingress.yaml</code>

Secara *default*, `ingress-nginx` mendeklarasikan *default* backend dengan URL `/healthz` yang mengembalikan halaman kosong dengan respon 200.  Pada konfigurasi saya, alamatnya adalah `http://latihan.jocki.me`.  Saya dapat menggunakan URL ini untuk memeriksa apakah `ingress-nginx` sudah bekerja dengan baik.  Sementara itu, konfigurasi pada file di `ingress.yaml` di atas akan menambahkan dua URL baru dengan *host* yang berbeda: `http://web.latihan.jocki.me` dan `http://api.latihan.jocki.me`.  Saya dapat memastikannya dengan memberikan perintah:

> <strong>$</strong> <code>kubectl get ingress</code>

Bagaimana cara saya mengakses URL tersebut?  Saat memakai `LoadBalancer` di *service*, saya harus menggunakan `minikube tunnel` untuk mengakses *service* tersebut dari komputer *host*.  Untuk *ingress controller*, saya dapat langsung menggunakan IP yang dihasilkan oleh perintah `minikube ip`.  Namun, nama *host* disini penting sehingga bila saya hanya menggunakan alamat IP, *ingress controller* tidak akan melewatkan *request* ke *service* yang seharusnya.  Salah satu solusinya adalah menyertakan header `Host` saat memanggil *ingress controler*.  Namun, solusi yang lebih umum ditempuh adalah dengan menambahkan nama domain ke `/etc/hosts`, seperti yang terlihat pada baris berikut ini (dengan asumsi `minikube ip` mengembalikan nilai `192.168.49.2`):

```
192.168.49.2    api.latihan.jocki.me
192.168.49.2	web.latihan.jocki.me
```

Sekarang, saya bisa mengakses *ingress controller* di IP 192.168.49.2 melalui `http://api.latihan.jocki.me` dan `http://web.latihan.jocki.me`.  Walaupun demikian, saya harus memperbaharui file `/etc/hosts` setiap kali menambahkan *host* baru di *ingress resource*.  Untuk mengotomatisasikan hal ini, minikube dilengkapi dengan addons `ingress-dns` yang pada dasarnya menyediakan sebuah DNS server yang bisa saya pakai di *host*.  Namun, ini membutuhkan perubahan di sistem operasi *host* supaya memakai DNS server tersebut.  

Sebagai alternatif, karena saya menggunakan DNSCrypt proxy yang juga berperan sebagai DNS *stub resolver*, saya dapat menggunakan fitur *cloaking*-nya untuk menambahkan *record* DNS statis.  Fitur *cloaking* hampir sama seperti dengan `/etc/hosts`, hanya saja ia mendukung *wildcard* yang diwakili dengan tanda `*`.  Saya kemudian menambahkan baris berikut ini pada file `cloaking-rules.txt` (sesuai dengan nama file yang tertera di `cloaking_rules` di file konfigurasi `dnscrypt-proxy.toml`):

```
*.latihan.jocki.me        192.168.49.2
```

Sekarang, semua domain yang diakhiri oleh `.latihan.jocki.me` seperti `api.latihan.jocki.me`, `test.api.latihan.jocki.me` dan sejenisnya akan diarahkan ke IP milik *ingress controller*.  Saya hanya perlu memastikan bahwa domain yang saya pakai di konfigurasi *ingress resource* selalu diakhiri dengan `.latihan.jocki.me`.

Salah satu hal yang paling umum di *ingress controller* adalah melihat log akses.  Sebagai contoh, saya dapat memberikan perintah berikut ini untuk melihat URL apa saja yang diakses oleh pengguna:

> <strong>$</strong> <code>kubectl logs -n ingress-nginx $(kubectl get -n ingress-nginx pod -l app.kubernetes.io/component=controller -o name)</code>

Hal lain yang sering dilakukan adalah melakukan terminasi TLS.  Dengan demikian, pengguna terhubung ke *ingress controller* melalui HTTPS, tetapi saat meneruskan ke *service* yang dituju, komunikasinya adalah komunikasi HTTP dari *ingress controller* ke *service*.  Ini akan membuat setiap *service* yang ada menjadi lebih ringan karena mereka tidak perlu menangani HTTPS.  *Coding* juga lebih gampang karena tidak perlu mengaktifkan HTTPS di masing-masing *service* seperti menambahkan `server.ssl.enabled` di Spring Boot, mengubah `http.createServer()` menjadi `https.createServer()` di Node.js, dan sebagainya.  Bila sertifikat kadaluarsa dan diperbaharui, saya hanya perlu melakukan registrasi sertifikat tersebut di *ingress controller* saja tanpa harus me-*restart* *service* yang sudah ada.

Saya dapat membuat sebuah sertifikat TLS *self-signed* dengan menggunakan perintah berikut ini:

> <strong>$</strong> <code>openssl req -new -newkey rsa:2048 -x509 -sha256 -days 3650 -nodes -out tls.crt -keyout tls.key -addext "subjectAltName = DNS:*.latihan.jocki.me"</code>

Akan muncul beberapa pertanyaan yang harus saya isi.  Pertanyaan yang paling penting adalah mengenai `CN` yang harus saya isi dengan nilai `*.latihan.jocki.me`.  Setelah perintah selesai dikerjakan, saya akan menemukan dua file baru dengan nama `tls.crt` dan `tls.key`.  Saya dapat menyimpan kedua file ini sebagai [TLS secret](https://kubernetes.io/docs/concepts/configuration/secret/#tls-secrets) di Kubernetes dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl create secret tls tls-secret --key tls.key --cert tls.crt</code>

Bila perintah di atas berhasil, saat saya memberikan perintah `kubectl get secret tls-secret`, saya akan menemukan sebuah *secret* dengan nama `tls-secret`.   Saya kemudian dapat mereferensikan `tls-secret` di file `ingress.yaml` di bagian `spec` seperti yang terlihat pada konfigurasi berikut ini:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress
  ...
spec:
  tls:
    - hosts:
        - web.latihan.jocki.me
        - api.latihan.jocki.me
      secretName: tls-secret
  ingressClassName: nginx
  rules:
    ...
```

Untuk menerapkan perubahan di atas, saya dapat memberikan perintah:

> <strong>$</strong> <code>kubectl apply -f ingress.yaml</code>

Setelah itu, saya dapat meng-*import* file `tls.crt` ke browser yang saya pakai.  Sebagai contoh, di Google Chrome, saya dapat melakukannya dengan memilih **Settings**, **Privacy and Security**, **Security**, **Manage certificates**.  Di tab Authorities, saya dapat men-klik tombol **Import** dan memilih file `tls.crt` agar dianggap terpercaya oleh Google Chrome.  Jangan pernah menambahkan sertifikat selain buatan sendiri, terutama dari pihak ketiga yang tidak dipercaya, karena ini akan mempermudah pembuat sertifikat dalam membuat web palsu karena .

<div class="alert alert-danger" role="alert">
<strong>PERINGATAN:</strong> Jangan pernah menambahkan sertifikat dari pihak ketiga yang tidak dipercaya karena ini akan membuat website palsu semakin sulit terdeteksi.  Browser tidak akan menampilkan informasi situs berbahaya lagi saat mengunjungi seluruh situs yang dibuat oleh pemilik sertifikat tersebut.
</div>

Sampai disini, bila saya membuka halaman HTTPS di browser, tidak akan ada pesan peringatan dan semua akan ditampilkan dengan baik.  Namun, hampir semua pemanggilan API selain dari *browser* akan mengalami kegagalan (misalnya dari *backend* ke *backend*).  Hal ini karena saya tidak menambahkan sertifikat *self-signed* saya untuk layanan tersebut. Yang membuat ini semakin rumit adalah tidak ada cara yang standar di sistem operasi Linux.  Sebagai contoh, di aplikasi Spring Boot yang gagal saat memanggil HTTPS lewat `RestTemplate`, saya perlu menambahkan sertifikat di Java dengan menggunakan `keytool`.  Untuk cURL, saya perlu menambahkan `--cacert`.  Di Python, saya perlu menambahkan `verify` saat memanggil `requests.post()`.  Cukup banyak yang harus dilakukan, bukan?

Oleh sebab itu, saya akan beralih ke sertifikat terpercaya yang diterbitkan oleh [Let's Encrypt](https://letsencrypt.org).  CA yang satu ini menyediakan sertifikat TLS tanpa biaya asalkan saya dapat membuktikan kalau saya adalah pemilik domain tersebut.  Metode pembuktian-nya melalui protokol Automatic Certificate Management Environment (ACME).  Khusus untuk *wildcard domain*, saya dapat menggunakan metode DNS01 dimana saya perlu menambahkan record TXT di konfigurasi DNS server saya.

Bila *cluster* Kubernetes saya selalu terhubung ke Internet, saya dapat menggunakan [cert-manager](https://cert-manager.io) yang akan secara otomatis mengelola sertifikat seperti membuat sertifikat baru dan memperbaharui sertifikat sebelum kadaluarsa.  `cert-manager` mendukung Let's Encrypt dan protokol ACME, termasuk DNS01.  Namun, pada percobaan ini, saya akan membuat sertifikat baru secara manual dengan menggunakan `certbot` melalui perintah berikut ini:

> <strong>$</strong> <code>sudo apt install certbot</code>

> <strong>$</strong> <code>sudo certbot certonly -a manual -d *.latihan.jocki.me</code>

Setelah menjawab beberapa pertanyaan, saya akan mendapatkan sebuah baris *challenge* yang perlu saya tambahkan di DNS server publik saya.  Bila Let's Encrypt berhasil melakukan validasi, saya akan mendapatkan beberapa file sertifikat berupa `cert.pem`, `chain.pem`, `fullchain.pem`, `privkey.pem`.  Yang paling penting disini adalah `fullchain.pem`.  Bila saya hanya menggunakan sertifikat ini, browser (seperti Chrome) akan melihat situs sebagai terpercaya.  Namun, ia belum cukup bila digunakan untuk pemanggilan *backend*, misalnya `ReactiveJwtDecoder` di Spring Boot akan gagal dengan pesan kesalahan seperti `"PKIX path building failed"` bila saya tidak menyertakan `chain.pem`.  Saya perlu menggabungkan hasil dari `fullchain.pem` dan `chain.pem` ke sebuah file seperti `tls.crt`.  Untuk itu, saya akan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>openssl rsa -in privkey.pem -out tls.key</code>

> <strong>$</strong> <code>openssl x509 -in chain.pem -out chain.crt</code>

> <strong>$</strong> <code>openssl x509 -in fullchain.pem -out fullchain.crt</code>

> <strong>$</strong> <code>cat fullchain.crt chain.crt > tls.crt</code>

> <strong>$</strong> <code>rm tls.key tls.crt chain.crt fullchain.crt</code>

Hasil akhir perintah di atas file `tls.key` dan `tls.crt` yang dapat langsung dipakai oleh *ingress controller*, misalnya dengan perintah seperti berikut ini:

> <strong>$</strong> <code>kubectl delete secret tls-secret</code>

> <strong>$</strong> <code>kubectl create secret tls tls-secret --key tls.key --cert tls.crt</code>

> <strong>$</strong> <code>kubectl delete pod -l app.kubernetes.io/component=controller -n ingress-nginx</code>

> <strong>$</strong> <code>kubectl apply -f ingress.yaml</code>

Sampai disini, saya akhirnya memiliki layanan HTTPS yang benar-benar bekerja dan dapat diakses dimana saja tanpa pesan kesalahan.  Saya tidak lupa menghapus *self signed certificate* yang sebelumnya saya daftarkan di Chrome karena sertifikat tersebut tidak dibutuhkan lagi.  Satu hal yang menarik disini adalah saya hanya akan memakai domain `*.latihan.jocki.me` di komputer lokal, mengapa perlu melibatkan pengaturan di DNS publik saya?  Saya perlu menambahkan record TXT di DNS publik untuk membuktikan kalau saya adalah pemilik domain tersebut.  Ini adalah salah satu alasan mengapa CA tidak boleh menerbitkan sertifikat untuk domain spesial seperti <code>*.localhost</code> dan <code>*.test</code> (karena domain tersebut dapat dimiliki semua orang).  Setelah mendapatkan sertifikat, saya berhak menggunakannya untuk jaringan internal ataupun eksternal (Internet), selama sertifikat digunakan untuk domain yang tercantum.  

Hal lain yang dapat saya lakukan di *ingress controller* adalah menambahkan dukungan CORS.  Bila saya melakukannya dari *ingress controller*, saya tidak perlu lagi menambahkan dukungan CORS di masing-masing *service* seperti menambahkan `http.cors()` di aplikasi Spring Boot, menambahkan *middleware* `cors` di aplikasi Node Express dan sebagainya.  Untuk melakukan pengaturan CORS di `ingress-nginx`, saya dapat menggunakan *annotations* seperti berikut ini:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-api
  annotations:    
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "POST, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://web.latihan.jocki.me"
spec:
  ingressClassName: nginx
  ...
```

Pada konfigurasi di atas, `ingress-nginx` secara otomatis akan menambahkan *header* `access-control-allow-origin` dengan nilai `https://web.latihan.jocki.me` pada saat *endpoints* di `https://api.latihan.jocki.me` dipanggil.  Karena addons di minikube yang saya pakai meng-*install* `ingress-nginx` v1.0.4, saya hanya bisa menggunakan satu domain saja di `nginx.ingress.kubernetes.io/cors-allow-origin`.  Namun bila saya menggunakan `ingress-nginx` v1.0.5 ke atas, saya dapat menambahkan lebih dari satu *domain* seperti `"http://localhost:4200, https://api.latihan.jocki.me"` untuk nilai *annotation* tersebut.
 