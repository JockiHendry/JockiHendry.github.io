---
layout: post
category: DevOps
title: Pengalamatan Pod dan Service Di Kubernetes
tags: [Kubernetes]
---

Kubernetes bekerja pada sistem terdistribusi yang terdiri atas satu atau lebih *server* yang disebut *node*.  Untuk mencobanya di komputer lokal, saya tidak perlu sampai membangun *home networking*.  Saya bisa  menggunakan [minikube](https://minikube.sigs.k8s.io) yang merupakan implementasi ringan dari Kubernetes yang memang ditujukan untuk dipakai di komputer lokal.  Minikube dapat menggunakan *hypervisor* dan *virtual machine* untuk men-simulasi-kan *node* Kubernetes di komputer yang sama.  Khusus untuk sistem operasi Linux, minikube juga dapat langsung menggunakan Docker untuk menciptakan *node* Kubernetes tanpa menggunakan VM.  Walaupun konsep "memakai *container* Docker untuk menjalankan Kubernetes yang akan mengelola *container* Docker lainnya" terdengar rekursif, ia menawarkan kinerja yang lebih baik.

Sebagai contoh, saya akan mulai dengan membuat *cluster* Kubernetes di Docker dengan memberikan perintah ini:

> <strong>$</strong> <code>minikube start --driver=docker --cni=calico --nodes=2 --profile=latihan</code>

> <strong>$</strong> <code>minikube profile latihan</code>

Perintah di atas akan membuat sebuah *cluster* Kubernetes yang terdiri atas 2 *node* di *profile* dengan nama `latihan` dan mengaktifkannya.  Dengan fasilitas *profile*, saya bisa memiliki lebih dari satu *cluster* *virtual* tanpa harus menghapus *cluster* yang sudah ada sebelumnya.

Bila saya memberikan perintah `docker ps` di komputer *host*, saya akan menemukan dua *container* Docker yang mewakili *cluster* Kubernetes lokal saya sudah dibuat secara otomatis oleh Minikube:

> <strong>$</strong> <code>docker ps --format '{% raw %}{{.Image}} {{.Names}}{% endraw %}'</code>

```
gcr.io/k8s-minikube/kicbase:v0.0.28 latihan-m02
gcr.io/k8s-minikube/kicbase:v0.0.28 latihan
```

Hasil di atas menunjukkan bawah saya berhasil membuat dua *node* Kubernetes.  Kedua *node* ini dijalankan dari dalam Docker (tanpa *virtual machine*) di komputer *host* (yang sedang saya pakai saat ini).  Untuk melihat IP-nya, saya bisa menggunakan perintah seperti:

> <strong>$</strong> <code>docker inspect -f '{% raw %}{{.Name}}: {{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}{% endraw %}' latihan latihan-m02</code>

```
/latihan: 192.168.49.2
/latihan-m02: 192.168.49.3
```

Komputer *host* dapat menghubungi kedua *container* tersebut, yang dapat dibuktikan dengan memberikan perintah `ping` `192.168.49.2` dan `ping 192.168.49.3` dari komputer *host*.  Walaupun demikian, Docker di komputer *host* hanya sekedar mengurus siklus hidup *container* tersebut dan tidak tahu seperti apa "isi"-nya.  Untuk mengetahui informasi lebih lanjut, saya harus menggunakan `kubectl`, seperti pada contoh berikut ini:

> <strong>$</strong> <code>kubectl get nodes -o wide</code>

```
NAME          STATUS   ROLES                  AGE   VERSION   INTERNAL-IP    EXTERNAL-IP   OS-IMAGE             KERNEL-VERSION     CONTAINER-RUNTIME
latihan       Ready    control-plane,master   24m   v1.22.3   192.168.49.2   <none>        Ubuntu 20.04.2 LTS   5.4.0-91-generic   docker://20.10.8
latihan-m02   Ready    <none>                 19m   v1.22.3   192.168.49.3   <none>        Ubuntu 20.04.2 LTS   5.4.0-91-generic   docker://20.10.8
```

Saya dapat menggunakan perintah `minikube ssh` untuk masuk ke dalam salah satu *node*, misalnya untuk melakukan *troubleshooting* sementara, seperti pada contoh berikut ini:

> <strong>$</strong> <code>minikube ssh -n latihan-m02</code>

> <strong>docker@latihan-m02:~$</strong> <code>ping host.minikube.internal</code>

```
PING host.minikube.internal (192.168.49.1) 56(84) bytes of data.
64 bytes from host.minikube.internal (192.168.49.1): icmp_seq=1 ttl=64 time=0.060 ms
64 bytes from host.minikube.internal (192.168.49.1): icmp_seq=2 ttl=64 time=0.042 ms
64 bytes from host.minikube.internal (192.168.49.1): icmp_seq=3 ttl=64 time=0.052 ms
64 bytes from host.minikube.internal (192.168.49.1): icmp_seq=4 ttl=64 time=0.043 ms
64 bytes from host.minikube.internal (192.168.49.1): icmp_seq=5 ttl=64 time=0.040 ms
```

Salah satu alamat yang unik pada minikube adalah `host.minikube.internal`.  Ini adalah alamat yang ditambahkan oleh minikube di setiap *node* yang ada.  Sesuai dengan namanya, alamat ini merujuk pada komputer *host*.  Programmer seharusnya tidak perlu sampai mengakses *node* atau melakukan konfigurasi di *node* secara langsung.

### Pod

Di Kubernetes, satuan unit eksekusi paling kecil disebut sebagai *pod*.  Sebuah *pod* dapat memiliki satu atau lebih *container* Docker.  Sebagai contoh, saya akan membuat sebuah *pod* dengan nama `p1` seperti berikut ini:

> <strong>$</strong> <code>kubectl run p1 --image=nginx --port=80</code>

*Pod* `p1` diatas hanya terdiri atas sebuah *container* Docker yang dibuat berdasarkan *image* `nginx` (diambil dari Docker Hub).  Bagaimana cara saya mengakses *pod* ini?  Bila saya memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl get pods -o wide</code>

```
NAME   READY   STATUS    RESTARTS   AGE     IP             NODE          NOMINATED NODE   READINESS GATES
p1     1/1     Running   0          1m30s   10.244.255.1   latihan-m02   <none>           <none>
```

Saya menemukan bahwa `p1` memiliki alamat IP `10.244.255.1` dan berjalan di *node* `latihan-m02` yang memiliki IP `192.168.49.3`.  *Pod* tidak di-akan dipublikasikan oleh *node* sehingga bila saya memberikan perintah seperti `curl 192.168.49.3`, saya tetap tidak dapat mengakses *container* `nginx` milik `p1`!  Saya juga tidak dapat menggunakan `curl 10.244.255.1` karena IP tersebut adalah IP internal.

Namun, bila ingin melakukan *troubleshooting* dan perlu mengakses sistem operasi di dalam *pod*, saya dapat menggunakan perintah seperti berikut ini:

> <strong>$</strong> <code>kubectl exec p1 -- bash</code>

Perintah di atas akan memberikan akses ke *shell* sistem operasi yang dipakai oleh *pod* sehingga saya dapat memberikan perintah CLI seolah-olah seperti berada di komputer lokal.

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> Sangat tidak disarankan untuk melakukan perubahan pada <em>pod</em> secara interaktif lewat <code>kubectl exec</code>.  Hal ini karena perubahan interaktif tersebut akan hilang setelah <em>pod</em> dilenyapkan oleh Kubernetes.  Cara yang lebih disarankan adalah segera melakukan perubahan pada <code>Dockerfile</code> setelah memastikan bahwa perintah interakif lewat SSH berhasil mengatasi permasalahan yang muncul.  Dengan menambahkan perintah yang sama ke <code>Dockerfile</code>, perbaikan akan tetap diterapkan saat <em>pod</em> baru dibuat, <em>node</em> di-<em>restart</em>, dan sebagainya.
</div>

Sebuah *pod* bisa memiliki lebih dari satu *container*.  Namun, karena *pod* merupakan satuan terkecil di Kubernetes, tidak ada perintah untuk menambahkan *container* ke *pod* yang sudah ada.  Sebagai contoh, bila saya mencoba menambahkan *container* baru ke *pod* `p1`, saya akan menemukan pesan kesalahan seperti:

> <strong>$</strong> <code>kubectl patch pod p1 --patch '{"spec": {"containers": [{"name": "network-sidecar", "image": "amazon/amazon-ecs-network-sidecar"}]}}'</code>

```
The Pod "p1" is invalid: spec.containers: Forbidden: pod updates may not add or remove containers
```

Ini menunjukkan bahwa struktur *container* di dalam *pod* sulit untuk berubah lagi.  Bila *container* tambahan memiliki fungsi yang jauh berbeda dari yang sudah ada di *pod*, sangat disarankan untuk membuat *pod* baru yang berisi *container* tersebut.  Ini akan membuat pengelolaan *container* tersebut menjadi lebih mudah.  Lalu, pada kasus seperti apa sebuah *pod* disarankan untuk memiliki lebih dari satu *container*?  Biasanya *container* tambahan di *pod* berhubungan dengan jaringan seperti *proxy* dan sebagainya.  Sebagai contoh, *container* `amazon-ecs-network-sidecar` yang hendak saya tambahkan adalah sebuah *container* yang berisi perintah seperti `traceroute`, `ifconfig`, dan sebagainya yang sangat membantu dalam *troubleshooting* jaringan.  Perintah tersebut tidak tersedia di *container* `nginx` karena *container* `nginx` berdasarkan `debian:slim` yang menghilangkan banyak file dan aplikasi yang tidak dibutuhkan.  Tujuannya supaya ukuran kecil dan *container* juga tidak berat.  Tentu saja saya juga bisa masuk ke dalam *container* dan memberikan perintah seperti `apt update` dan `apt install`, tapi ini akan men-"cemari" *container* tersebut.

Karena tidak bisa menambah *container* baru melalui perintah `kubectl`, saya akan melakukannya melalui file *manifest*  seperti `latihan.yaml` yang memiliki isi:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: p1
spec:
  restartPolicy: Never
  containers:
    - name: p1-c1
      image: nginx
    - name: p1-c2
      image: amazon/amazon-ecs-network-sidecar
---
apiVersion: v1
kind: Pod
metadata:
  name: p2
spec:
  restartPolicy: Never
  containers:
    - name: p2-c1
      image: nginx
    - name: p2-c2
      image: amazon/amazon-ecs-network-sidecar
```

Saya kemudian menghapus `p1` dan membuat ulang *pod* berdasarkan file konfigurasi di atas:

> <strong>$</strong> <code>kubectl delete pod p1</code>

> <strong>$</strong> <code>kubectl apply -f latihan.yaml</code>

Sekarang, saya akan memiliki dua *pod* `p1` dan `p2` dimana masing-masing *pod* memiliki dua *container*, seperti yang terlihat pada hasil berikut ini:

> <strong>$</strong> <code>kubectl get pods -o wide</code>

```
NAME   READY   STATUS    RESTARTS   AGE   IP             NODE          NOMINATED NODE   READINESS GATES
p1     2/2     Running   0          63s   10.244.255.6   latihan-m02   <none>           <none>
p2     2/2     Running   0          63s   10.244.255.5   latihan-m02   <none>           <none>
```

Walaupun terdapat dua *container* di `p1` dan `p2`, masing-masing *pod* hanya memiliki satu alamat IP.  Oleh sebab itu, saya harus berhati-hati memastikan bahwa tidak ada *container* yang berusaha mendapatkan akses ke *port* yang sama di *pod* yang sama.  Anggap saja `p1-c1` dan `p1-c2` adalah aplikasi yang berjalan di komputer yang sama sehingga jika mereka sama-sama berusaha memakai *port* yang sama, hanya salah satu dari mereka yang sukses akan dan yang satunya lagi akan gagal.  Bila saya memberikan perintah:

> <strong>$</strong> <code>kubectl exec p1 -c p1-c2 -- netstat -anp</code>

```
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name    
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -                   
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1/sshd              
tcp6       0      0 :::80                   :::*                    LISTEN      -                   
tcp6       0      0 :::22                   :::*                    LISTEN      1/sshd              

```

saya menemukan bahwa *container* `p1-c2` melihat *port* yang dipakai oleh *container* `p1-c1` seolah-olah mereka berada di dalam komputer yang sama.  Bukan hanya itu, bila saya memberikan perintah:

> <strong>$</strong> <code>kubectl exec p1 -c p1-c2 -- ifconfig</code>

```
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1480
        inet 10.244.255.6  netmask 255.255.255.255  broadcast 10.244.255.6        
```

Terlihat bahwa IP *pod* yang sama seperti di `p1-c1` juga dipakai oleh `p1-c2`, seolah-olah mereka berada di komputer yang sama.

Apakah *pod* yang satu dapat menghubungi *pod* yang lainnya? Yup, walaupun tidak ada bantuan dari DNS, asalkan tahu nama alamat IP *pod* yang hendak dituju, mereka dapat saling berkomunikasi, seperti yang ditunjukkan pada perintah berikut ini:

> <strong>$</strong> <code>kubectl exec p1 -c p1-c2 -- traceroute 10.244.255.5</code>

```
traceroute to 10.244.255.5 (10.244.255.5), 30 hops max, 60 byte packets
 1  latihan-m02.latihan (192.168.49.3)  0.055 ms  0.008 ms  0.007 ms
 2  10.244.255.5 (10.244.255.5)  0.055 ms  0.015 ms  0.013 ms
```

Bagaimana bila *pod* berada di *node* yang berbeda?  Untuk mencobanya, saya akan menambahkan baris berikut ini pada `latihan.yaml`:

```yaml
...
---
apiVersion: v1
kind: Pod
metadata:
  name: p3
spec:
  restartPolicy: Never
  containers:
    - name: p3-c1
      image: nginx
    - name: p3-c2
      image: amazon/amazon-ecs-network-sidecar
  nodeSelector:
    name: latihan
```

Pada deklarasi `p3` di atas, saya menambahkan `nodeSelector` sehingga *pod* ini hanya akan di-*deploy* di *node* yang memiliki *label* `name` dengan nilai `latihan`.  Untuk menambahkan *label* ke sebuah *node* dan membuat `p3`, saya menggunakan perintah berikut ini:

> <strong>$</strong> <code>kubectl label nodes latihan name=latihan</code>

> <strong>$</strong> <code>kubectl apply -f latihan.yaml</code>

Sekarang, saya akan menemukan `p3` yang di-*deploy* di *node* berbeda dari `p1` and `p2` seperti yang terlihat di hasil perintah berikut ini:

> <strong>$</strong> <code>kubectl get pods -o wide</code>

```
NAME   READY   STATUS    RESTARTS   AGE     IP             NODE          NOMINATED NODE   READINESS GATES
p1     2/2     Running   0          9m     10.244.255.6   latihan-m02   <none>           <none>
p2     2/2     Running   0          9m     10.244.255.5   latihan-m02   <none>           <none>
p3     2/2     Running   0          9m     10.244.103.3   latihan       <none>           <none>
```

Apakah `p1` dapat menghubungi `p3` yang berada di *node* berbeda?  Yup, bisa, seperti yang dibuktikan oleh perintah berikut ini:

> <strong>$</strong> <code>kubectl exec p1 -c p1-c2 -- traceroute 10.244.103.3</code>

```
traceroute to 10.244.103.3 (10.244.103.3), 30 hops max, 60 byte packets
 1  latihan-m02.latihan (192.168.49.3)  0.050 ms  0.010 ms  0.008 ms
 2  10.244.103.0 (10.244.103.0)  0.105 ms  0.033 ms  0.030 ms
 3  10.244.103.3 (10.244.103.3)  0.067 ms  0.035 ms  0.031 ms
```

Hasil di atas juga menunjukkan adanya *hop* tambahan karena ini melibatkan jaringan yang berbeda yang berada di komputer berbeda (walaupun *virtual* bila dijalankan di minikube). 

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> Pada kasus nyata, gunakan <em>deployment</em> dan/atau <em>service</em> untuk mengelola <em>pod</em>.  <em>Pod</em> memiliki siklus hidup yang singkat.  Mereka tidak permanen, dapat dilenyapkan dan dibuat baru sesuai kebutuhan Kubernetes (misalnya karena operasi <em>scaling down</em> atau ada <em>node</em> yang rusak).  Setiap kali <em>pod</em> baru dibuat, <em>pod</em> tersebut akan memiliki IP berbeda.
</div>

Sekarang saya sudah berhasil membuat dua *pod* saling berkomunikasi. Lalu, bagaimana caranya supaya *pod* tersebut dapat diakses oleh pihak luar?  Tidak ada gunanya membuat sebuah aplikasi yang hanya berkomunikasi secara internal namun tidak dapat dipanggil oleh pengguna, bukan?  Untuk mejawab pertanyaan ini, Kubernetes memiliki apa yang disebut sebagai *service*.

Sebelum menggunakan *service*, pada kasus tertentu yang sangat jarang terjadi, *pod* dapat menggunakan jaringan di *node* secara langsung dengan mengisi nilai `hostNetwork` dengan `true` seperti pada konfigurasi berikut ini:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: p1
spec:
  restartPolicy: Never
  hostNetwork: true
  containers:
    - image: nginx
      name: nginx
      ports:
        - containerPort: 80
```

Bila saya memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl get pods -o wide</code>

```
NAME   READY   STATUS    RESTARTS   AGE   IP             NODE           NOMINATED NODE   READINESS GATES
p1     1/1     Running   0          50s   192.168.49.3   minikube-m02   <none>           <none>
```

Saya dapat melihat bahwa *pod* tersebut dapat diakses melalui IP *node* (`192.168.49.3`) secara langsung.  Bila saya memberikan perintah `curl 192.168.49.3` dari komputer *host*, saya dapat langsung mengakses NGINX di *pod* tersebut.  Cara ini adalah cara paling singkat untuk membiarkan sebuah *pod* dapat diakses secara langsung, namun juga merupakan cara yang paling berbahaya dan sebaiknya dihindari kecuali pada kasus-kasus tertentu.

<div class="alert alert-danger" role="alert">
<strong>PENTING:</strong>  Sebuah <em>pod</em> yang menggunakan <em>host network</em> dapat melihat aktifitas jaringan di <em>node</em> tersebut termasuk melihat komunikasi yang terjadi pada <em>pod</em> lain yang juga berada di <em>node</em> yang sama.  Dengan kata lain, dari sisi jaringan, <em>pod</em> tersebut tidak lagi berada dalam <em>container</em>.  Ini cukup berbahaya bila dilihat dari sisi keamanan komputer.
</div>

### Service

Untuk membuktikan bahwa *pod* tidak memiliki alamat yang tetap, saya akan me-*restart* minikube dengan `minikube stop` dan `minikube start`.  Karena tidak ada *deployment* yang berusaha membuat ulang *pod*, saya akan menemukan *pod* saya berada dalam status `Completed`.  Saya kemudian membuat ulang *pod* dengan perintah seperti:

> <strong>$</strong> <code>kubectl delete -f latihan.yaml</code>

> <strong>$</strong> <code>kubectl apply -f latihan.yaml</code>

> <strong>$</strong> <code>kubectl get pods -o wide</code>

```
NAME   READY   STATUS    RESTARTS   AGE   IP             NODE          NOMINATED NODE   READINESS GATES
p1     2/2     Running   0          48s   10.244.255.5   latihan-m02   <none>           <none>
p2     2/2     Running   0          48s   10.244.255.4   latihan-m02   <none>           <none>
p3     2/2     Running   0          48s   10.244.103.6   latihan       <none>           <none>
```

Terlihat bahwa walaupun *pod* dengan nama yang sama dibuat ulang, mereka memiliki IP yang berbeda.  Bila pihak yang memanggil *pod* masih memakai IP lama, mereka tidak akan terhubung lagi (atau terhubung ke *pod* yang salah).  Untuk mengatasi hal ini, Kubernetes memiliki konsep *service*.  Sebagai contoh, saya mengubah file `latihan.yaml` menjadi seperti berikut ini:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: p1
  labels:
    service: s1
spec:
  restartPolicy: Never
  containers:
    - name: p1-c1
      image: nginx
    - name: p1-c2
      image: amazon/amazon-ecs-network-sidecar
---
apiVersion: v1
kind: Pod
metadata:
  name: p2
  labels:
    service: s2
spec:
  restartPolicy: Never
  containers:
    - name: p2-c1
      image: nginx
    - name: p2-c2
      image: amazon/amazon-ecs-network-sidecar
---
apiVersion: v1
kind: Pod
metadata:
  name: p3
  labels:
    service: s1
spec:
  restartPolicy: Never
  containers:
    - name: p3-c1
      image: nginx
    - name: p3-c2
      image: amazon/amazon-ecs-network-sidecar
  nodeSelector:
    name: latihan
---
apiVersion: v1
kind: Service
metadata:
  name: s1
spec:
  selector:
    service: s1
  ports:
    - port: 80
```

Setelah itu, saya menjalankan perintah berikut ini mengaplikasikan perubahan yang saya buat:

> <strong>$</strong> <code>kubectl apply -f latihan.yaml</code>

> <strong>$</strong> <code>kubectl get service</code>

```
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   10.96.0.1       <none>        443/TCP   45m
s1           ClusterIP   10.108.241.53   <none>        80/TCP    80s
```

Konfigurasi di atas akan membuat sebuah *service* `s1` yang terdiri atas *pod* `p1` dan `p3`.  Yup, walaupun *pod* berada di *node* yang berbeda, mereka tetap dapat dijadikan sebagai satu *service* yang sama.  Sekarang, saya dapat mengakses `p1` dan `p3` berdasarkan IP milik `s1`, seperti yang terlihat pada contoh berikut ini:

> <strong>$</strong> <code>kubectl exec p1 -c p1-c1 -- bash -c "echo Ini adalah p1 > /usr/share/nginx/html/index.html"</code>

> <strong>$</strong> <code>kubectl exec p3 -c p3-c1 -- bash -c "echo Ini adalah p3 > /usr/share/nginx/html/index.html"</code>

> <strong>$</strong> <code>kubectl exec p2 -c p2-c2 -- curl -s s1</code>

```
Ini adalah p3
```

> <strong>$</strong> <code>kubectl exec p2 -c p2-c2 -- curl -s s1</code>

```
Ini adalah p3
```

> <strong>$</strong> <code>kubectl exec p2 -c p2-c2 -- curl -s s1</code>

```
Ini adalah p1
```

Terlihat bahwa DNS yang dipakai oleh Kubernetes kini mendaftarkan `s1` yang merujuk ke alamat IP untuk *service* tersebut.  *Service* juga berperan sebagai *load balancer*.  Bila saya mengerjakan perintah `curl` di atas berulang kali, terkadang ia akan merujuk ke *pod* `p1` dan terkadang merujuk ke `p3`.  Dengan demikian, di aplikasi yang harus memanggil `p1` atau `p3`, saya tidak perlu menggunakan alamat IP `p1` dan `p3` secara langsung, melainkan cukup menggunakan `s1`.

Bila saya menghapus dan membuat ulang `p1` dan `p3`, saya akan menemukan bahwa nilai IP untuk `s1` akan diperbaharui sesuai secara otomatis sesuai dengan IP terbaru dari `p1` dan `p3` seperti yang terlihat pada percobaan berikut ini:

> <strong>$</strong> <code>kubectl get endpoints s1</code>

```
NAME   ENDPOINTS                         AGE
s1     10.244.103.8:80,10.244.255.8:80   3m35s
```

> <strong>$</strong> <code>kubectl delete pod/p1 pod/p3</code>

> <strong>$</strong> <code>kubectl apply -f latihan.yaml</code>

> <strong>$</strong> <code>kubectl get endpoints s1</code>

```
NAME   ENDPOINTS                         AGE
s1     10.244.103.9:80,10.244.255.9:80   4m27s
```

Terlihat bahwa *service* sudah menyelesaikan permasalahan alamat *pod* yang tidak kekal.  Namun, ini masih belum menjawab pertanyaan bagaimana pengguna bisa mengakses layanan karena IP yang dipakai oleh `s1` adalah IP internal yang tidak dapat diakses dari luar.  Secara *default*, tipe *service* yang dibuat adalah `ClusterIP` yang menggunakan IP internal.  Untuk *service* yang dapat diakses dari luar, saya bisa mencoba menggunakan tipe `NodePort` seperti pada contoh berikut ini:

> <strong>$</strong> <code>kubectl delete service s1</code>

> <strong>$</strong> <code>kubectl expose pod p1 --port=80 --name=s1 --type=NodePort</code>

> <strong>$</strong> <code>kubectl get services</code>

```
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
kubernetes   ClusterIP   10.96.0.1       <none>        443/TCP        116m
s1           NodePort    10.104.165.13   <none>        80:31686/TCP   5s
```

Hasil di-atas menunjukkan bahwa port `80` di `p1` dan `p3` dapat diakses melalui IP *node* di *port* `31686`.  Saya bisa mencobanya dengan memberikan perintah:

> <strong>$</strong> <code>curl -s 192.168.49.2:31686</code> (untuk *node* pertama)

> <strong>$</strong> <code>curl -s 192.168.49.3:31686</code> (untuk *node* kedua)

Pada saat mengakses `192.168.49.2`,  *request* akan diarahkan ke *pod* `p3`.  Sementara itu, untuk `192.168.49.3`, *request* akan diarahkan ke *pod* `p1`.  Untuk mempermudah, minikube juga memiliki perintah untuk mendapatkan IP *node* dan *port* berdasarkan nama *service*:

> <strong>$</strong> <code>minikube service --url s1</code>

```
http://192.168.49.2:31686
```

`NodePort` akan mempublikasikan informasi *service* tersebut ke seluruh *node* yang ada.  Setiap *service* akan diasosiasikan dengan *port* tertentu (secara default mulai dari *port* 30000 sampai 32767) di seluruh *node* yang ada.  Sebagai contoh, bila saya mendeklarasikan dua *pod* NGINX yang memakai *port* 80 secara internal, versi *service* `NodePort` untuk kedua *pod* tersebut akan terlihat seperti:

> <strong>$</strong> <code>kubectl get services</code>

```
NAME         TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)        AGE
kubernetes   ClusterIP   10.96.0.1        <none>        443/TCP        23m
service1     NodePort    10.104.155.201   <none>        80:30971/TCP   10m
service2     NodePort    10.99.118.194    <none>        80:31166/TCP   10m
```

Untuk mengakses *service* di atas, saya dapat menggunakan alamat `http://<ipnode>:30971` untuk *service1* dan `http://<ipnode>:31166` untuk *service2*.  Saya dapat menggunakan IP *node* apa saja karena `NodePort` dipublikasikan ke seluruh *node* yang ada.  Bila saya mengakses IP untuk *node1* dan ternyata *pod* tujuan saya tidak ada disana, *request* akan diteruskan ke *node* yang mengandung *pod* tujuan tersebut.  Salah satu kelemahannya adalah bila *node1* mengalami masalah dan aplikasi klien hanya akan memanggil IP *node1*, maka seluruh *service* tidak akan bisa diakses.  Salah solusi untuk mengatasi masalah tersebut adalah dengan membuat *service* dengan tipe `LoadBalancer`.  *Service* `LoadBalancer` membutuhkan sebuah *load balancer* eksternal yang tidak dikelola oleh Kubernetes.  *Load balancer* ini bisa berbeda-beda tergantung pada instalasi Kubernetes yang dipakai, namun tugasnya selalu sama: mendistribusikan *request* langsung ke *node* yang memiliki *pod* tujuan.

Saya bisa membuat *service* dengan tipe `LoadBalancer` dengan menggunakan perintah seperti berikut ini:

> <strong>$</strong> <code>kubectl delete service s1</code>

> <strong>$</strong> <code>kubectl expose pod p1 --port=80 --name=s1 --type=LoadBalancer</code>

> <strong>$</strong> <code>kubectl expose pod p2 --port=80 --name=s2 --type=LoadBalancer</code>

> <strong>$</strong> <code>kubectl get services -o wide</code>

```
NAME         TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)        AGE    SELECTOR
kubernetes   ClusterIP      10.96.0.1        <none>        443/TCP        145m   <none>
s1           LoadBalancer   10.97.11.234     <pending>     80:30731/TCP   74s    service=s1
s2           LoadBalancer   10.102.179.113   <pending>     80:32361/TCP   65s    service=s2
```

Bila ini dilakukan di Kubernetes di *cloud*, nilai External-IP akan terisi alamat IP publik yang dapat saya akses dari mana saja.  Sebagai contoh, Google Kubernetes Engine (GKE) akan menggunakan layanan Cloud Load Balancing (GLB) sebagai *load balancer* yang dipakai.  Sementara itu, untuk percobaan lokal dengan minikube, saya dapat menjalankan perintah berikut ini:

> <strong>$</strong> <code>minikube tunnel</code>

Aplikasi *tunnel* ini harus tetap berjalan selama menguji *load balancer* dan tidak boleh dimatikan; sama seperti pada kasus produksi dimana *load balancer* eksternal harus tetap aktif.  Tidak lama seperti perintah ini diberikan, bila saya memberikan perintah `kubectl get services` lagi, nilai External-IP akan terisi.  Ini menunjukkan bahwa saya dapat mengakses `s1` dan `s2` dari klien (dalam hal ini adalah komputer *host*), seperti:

> <strong>$</strong> <code>curl -s 10.97.11.234</code>

> <strong>$</strong> <code>curl -s 10.102.179.113</code>

Setiap *service* `LoadBalancer` memiliki alamat IP publik masing-masing.  Biasanya IP publik akan di-asosiasikan dengan sebuah domain, misalnya `s1.jocki.me` atau `s2.jocki.me`.  Ada juga yang disebut sebagai *wildcard DNS record*, misalnya jika saya menetapkan `*.service.jocki.me` ke sebuah *server*, maka seluruh akses seperti `a.service.jocki.me`, `b.service.jocki.me`, `www.service.jocki.me`, dan sebagainya akan diarahkan ke *server* tersebut.  *Server* tersebut kemudian bisa menentukan apa yang harus dikembalikan berdasarkan nama *host* yang diakses.  Terlihat sangat sederhana bukan?  Untuk menggunakan *wildcard DNS record*, saya dapat menggunakan fasilitas *ingress controller* di Kubernetes.  Saat ini,  karena memakai IP publik dari *load balancer*, saya harus mendaftarkan DNS record untuk setiap *service* secara manual.