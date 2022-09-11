---
layout: post
category: DevOps
title: Menggunakan IP Yang Sama Untuk Beberapa Service TCP Berbeda
tags: [Kubernetes]
---

Di Kubernetes, terdapat Ingress yang dapat dipakai untuk mempublikasikan beberapa Service berbeda melalui satu IP yang
sama.  Akan tetapi, sintaks Ingress hanya bekerja pada lapisan HTTP(S) dimana ia melakukan pemetaan ke Service berdasarkan
*path* di URL. Namun, ada kalanya layanan non-HTTP juga perlu dipublikasikan.  Layanan TCP/UDP non-HTTP tidak mengenal konsep
URL yang hanya ada di aplikasi web.  Lalu, bagaimana bila ingin melakukan hal yang sama seperti di Ingress tetapi 
pemetaan dilakukan berdasarkan nomor *port*?

Untuk menunjukkan permasalahan ini secara jelas, saya akan membuat dua StatefulSet baru yang menerima koneksi dari *port* TCP 
yang berbeda.  Pada percobaan sederhana ini, saya akan menggunakan `nc -lp` untuk mewakili sebuah layanan yang menerima 
koneksi di *port* tertentu.  Sebagai contoh, ini adalah definisi untuk `layanan-xyz-port-10000`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: layanan-xyz-port-10000
spec:
  serviceName: layanan-xyz-port-10000
  replicas: 1
  selector:
    matchLabels:
      app: layanan-xyz
      jenis: port-10000
  template:
    metadata:
      labels:
        app: layanan-xyz
        jenis: port-10000
    spec:
      containers:
        - name: alpine
          image: alpine
          ports:
            - containerPort: 10000
          command: ["/bin/sh"]
          args: ["-c", "while true; do echo 'respon dari port 10000' | nc -lp 10000; done"]
```

Dan ini adalah definisi untuk `layanan-xyz-port-20000`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: layanan-xyz-port-20000
spec:
  serviceName: layanan-xyz
  replicas: 3
  selector:
    matchLabels:
      app: layanan-xyz
      jenis: port-20000
  template:
    metadata:
      labels:
        app: layanan-xyz
        jenis: port-20000
    spec:
      containers:
        - name: alpine
          image: alpine
          ports:
            - containerPort: 20000
          command: [ "/bin/sh" ]
          args: [ "-c", "while true; do echo 'respon dari port 20000' | nc -lp 20000; done" ]
```

Salah satu pendekatan naif untuk mempublikasikan kedua StatefulSet di atas adalah dengan menggunakan *selector* `app=layanan-xyz`
karena kedua StatefulSet di atas sama-sama memiliki label `app=layanan-xyz`.  Sebagai contoh, saya akan mencoba membuat sebuah
Service seperti berikut ini:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: layanan-xyz
  labels:
    app: layanan-xyz
spec:
  selector:
    app: layanan-xyz
  type: LoadBalancer
  ports:
    - port: 10000
      targetPort: 10000
      name: port-10000
    - port: 20000
      targetPort: 20000
      name: port-20000
```

Walaupun secara sintaks, tidak ada yang salah pada *manifest* di atas, terdapat sebuah kesalahan logika yang mungkin saja bisa terlewatkan.
Service di atas akan menerima masukan pada *port* `10000` dan *port* `20000` lalu melewatkannya ke seluruh Pod yang memenuhi kriteria
`app=layanan-xyz` (gabungan antara `layanan-xyz-port-10000` dan `layanan-xyz-port-20000`) secara acak.  Ini berarti ada kemungkinan 
*request* untuk *port* `10000` dilewatkan ke `layanan-xyz-port-20000` dan juga sebaliknya.  Karena `layanan-xyz-port-20000` tidak menerima
koneksi di *port* `10000`, tentu saja ini akan menimbulkan pesan kesalahan "Connection refused".  Oleh sebab itu, bila saya mencoba melakukan 
koneksi  berulang kali ke port `10000`, akan ada kemungkinan saya menerima pesan kesalahan seperti berikut ini:

> <strong>$</strong> <code>nc -v &lt;ip_load_balancer&gt; 10000</code>

```
nc: connect to <ip_load_balancer> port 10000 (tcp) failed: Connection refused
```

Tergantung pada keberuntungan apakah koneksi akan diteruskan ke Pod yang benar, beberapa penggunaka akan mendapatkan respon
sukses dan pengguna lainnya akan mendapatkan pesan kesalahan.  Tentu saja saya tidak ingin aplikasi yang eksekusinya bergantung
pada keberuntungan! Dengan demikian, Service di atas tidak dapat dipakai untuk melewatkan layanan melalui *port* berbeda dengan IP yang sama!

Salah satu solusi untuk permasalahan ini adalah dengan menggunakan Ingress Controller yang memiliki kapabilitas untuk meneruskan
layanan TCP/UDP.  Sebagai latihan, saya akan menggunakan `ingress-nginx` yang sudah memiliki kemampuan serupa.  Karena definisi Ingress 
bawaan Kubernetes hanya mendukung sintaks pembagian berdasarkan *path*, sebagai gantinya, `ingress-nginx` menggunakan `ConfigMap` dengan
sintaks-nya tersendiri yang hanya dimengerti oleh Ingress Controller tersebut.

Fitur penerusan TCP/UDP di `ingress-nginx` tidak diaktifkan secara default!  Oleh sebab itu, saya perlu mengaktifkannya terlebih dahulu sebelum
melakukan instalasi `ingress-nginx`.  Sebagai contoh, saya melakukan perubahan pada file <https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.3.1/deploy/static/provider/cloud/deploy.yaml>
dengan menambahkan baris `--tcp-services-configmap` di `args` untuk `Deployment` dengan nama `ingress-nginx-controller`:

```yaml
#... <tidak disertakan> ...
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app.kubernetes.io/component: controller
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
    app.kubernetes.io/version: 1.3.1
  name: ingress-nginx-controller
  namespace: ingress-nginx
spec:
  # ... <tidak disertakan> ...
    spec:
      containers:
      - args:
        - /nginx-ingress-controller
        - --publish-service=$(POD_NAMESPACE)/ingress-nginx-controller
        - --election-id=ingress-controller-leader
        - --controller-class=k8s.io/ingress-nginx
        - --ingress-class=nginx
        - --configmap=$(POD_NAMESPACE)/ingress-nginx-controller
        - --validating-webhook=:8443
        - --validating-webhook-certificate=/usr/local/certificates/cert
        - --validating-webhook-key=/usr/local/certificates/key
        - --tcp-services-configmap=$(POD_NAMESPACE)/tcp-services
  # ... <tidak disertakan> ...
```

Selain itu, saya juga perlu mempublikasikan port yang dibutuhkan dengan menambahkannya di bagian Service `ingress-nginx-controller`:

```yaml
#... <tidak disertakan> ...
apiVersion: v1
kind: Service
metadata:
  labels:
    app.kubernetes.io/component: controller
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
    app.kubernetes.io/version: 1.3.1
  name: ingress-nginx-controller
  namespace: ingress-nginx
spec:
  # ... <tidak disertakan> ...  
  ports:
    # ... <tidak disertakan> ...  
  - name: port-10000
    port: 10000
    targetPort: 10000
    protocol: TCP
  - name: port-20000
    port: 20000
    targetPort: 20000
    protocol: TCP
  # ... <tidak disertakan> ...
```

Sekarang, saya siap melakukan instalasi dengan memberikan perintah `kubectl apply -f deploy.yaml` dimana `deploy.yaml`
mewakili file *manifest* yang telah saya modifikasi di atas.

Berikutnya, saya perlu membuat Service lokal yang mewakili masing-masing layanan yang hendak diakses melalui `ingress-nginx`.  
Sebagai contoh, saya membuat Service dengan isi seperti berikut ini untuk menerima pesan di port `10000`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: layanan-xyz-port-10000
spec:
  type: ClusterIP
  selector:
      app: layanan-xyz
      jenis: port-10000
  ports:
    - protocol: TCP
      port: 10000
      targetPort: 10000
```

Saya juga melakukan hal serupa untuk membuat Service yang menerima pesan di port `20000`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: layanan-xyz-port-20000
spec:
  type: ClusterIP
  selector:
      app: layanan-xyz
      jenis: port-20000
  ports:
    - protocol: TCP
      port: 20000
      targetPort: 20000
```

Sebagai langkah terakhir, saya perlu membuat ConfigMap dengan nama `tcp-services` yang mewakili pemetaan dari port TCP
ke Service yang bersangkutan dengan isi seperti berikut ini:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tcp-services
  namespace: ingress-nginx
data:
  10000: "default/layanan-xyz-port-10000:10000"
  20000: "default/layanan-xyz-port-20000:20000"
```

Pada konfigurasi di atas, `default/layanan-xyz-port-10000` dan `default/layanan-xyz-port-20000` adalah nama Service yang 
saya buat pada langkah sebelumnya.  Keduanya berada di *namespace* `default` bawaan (ini adalah *namespace* yang dipakai bila tidak ditentukan).

Sekarang, bila saya mengakses port `10000` dari IP milik `ingress-nginx-controller`, saya akan selalu mendapatkan respon dari
Service yang benar tanpa pesan kesalahan "Connection refused" lagi:

> <strong>$</strong> <code>nc &lt;ip_ingress_controller&gt; 10000</code>

```
respon dari port 10000
```

Begitu juga bila saya mengakses port `20000` dari IP tersebut, saya tidak akan menemukan pesan kesalahan lagi:

> <strong>$</strong> <code>nc &lt;ip_ingress_controller&gt; 20000</code>

```
respon dari port 20000
```
