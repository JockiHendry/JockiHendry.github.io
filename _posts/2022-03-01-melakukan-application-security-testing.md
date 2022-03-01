---
layout: post
category: DevOps
title: Belajar Melakukan Application Security Testing
tags: [Docker]
---

Saat mendengar istilah "keamanan komputer", biasanya yang berada dalam bayangan adalah *hacking*.  Namun kini keamanan komputer sudah berubah menjadi industri dimana banyak *vendor* berlomba-lomba menawarkan produk keamanan mereka.  Sepertinya *security engineer* akan lebih banyak menghabiskan waktu memilih produk keamanan untuk dipakai (atau berbicara dengan *sales* produk keamanan) ketimbang berada di situasi *hacking* yang menegangkan seperti di film aksi Hollywood :) Sama seperti di industri lainnya, *cyber security* juga punya terminologi sendiri. Sebagai contoh, *tool* untuk menguji keamanan aplikasi biasanya dikategorikan menjadi:

1. Static Application Security Testing (SAST)
1. Dynamic Application Security Testing (DAST)
1. Interactive Application Security Testing (IAST)

Bila aplikasi berjalan di *cloud*, terdapat beberapa kategori *tool* untuk memeriksa keamanan di *cloud* seperti:

1. Cloud Workload Protection Platform (CWPP)
1. Cloud Security Posture Management (CSPM)
1. Cloud Access Security Broker (CASB)

Pada artikel ini, saya akan mencoba memakai beberapa tool gratis yang terdaftar di <https://owasp.org/www-community/Free_for_Open_Source_Application_Security_Tools> untuk melakukan pengujian keamanan aplikasi.

### Static Application Security Testing (SAST)

SAST merupakan salah satu bentuk *white-box testing* dimana *tool* akan menganalisa seluruh kode program yang ada untuk mencari kemungkinan celah keamanan.  Karena tidak perlu menjalankan aplikasi, ini adalah bentuk pengujian yang paling gampang di-integrasi-kan dengan tool CI/CD.  Proses *deployment* dapat segera dihentikan bila *tool* SAST mendeteksi celah keamanan kritis di kode program.

SAST juga biasanya sangat mudah di-*setup*.  Sebagai contoh, bila menggunakan GitHub, terdapat fitur [code scanning](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning) yang gratis untuk *public repository*.  Untuk mengaktifkannya, saya dapat memilih tab **Security** di *repository* saya, men-klik tab **Overview** dan men-klik tombol **Set up code scanning**.  Secara bawaan, GitHub akan memakai CodeQL dimana saya hanya perlu men-klik tombol **Configure CodeQL alerts**.  Ini akan menambahkan sebuah konfigurasi Github Actions baru dengan nama `codeql-analysis.yml` yang akan memanggil *action* seperti `github/codeql-action/init` dan `github/codeql-action/analyze`.  Setelah ini, setiap kali *commit* pada *branch* `main` akan memicu eksekusi CodeQL.

Contoh hasil eksekusi GitHub Action yang melakukan pengujian SAST dengan CodeQL dapat dijumpai di <https://github.com/JockiHendry/latihan-k8s/actions/runs/1911555844> milik *repository* publik saya.  Untuk melihat hasil analisanya, saya dapat membuka tab **Security** dan memilih **Code scanning alerts**.  Halaman ini tidak dapat di-akses oleh publik, namun sebagai pemilik *repository*, saya akan menemukan laporan seperti pada gambar berikut ini:

![Tampilan Code Scanning Alerts Di Github]({{ "/assets/images/gambar_00078.png" | relative_url}}){:class="img-fluid rounded"}


Selain diterapkan di CI/CD, *tool* SAST biasanya juga ter-integrasi dengan IDE sehingga programmer akan mendapatkan informasi keamanan kode program langsung tanpa harus menjalankan aplikasi.  Sebagai latihan, saya akan mengaktifkan plugin [Snyk](https://snyk.io/) di IDE IntelliJ IDEA yang saya pakai.  Selain SAST, plugin Snyk ini juga akan melakukan Software Composition Analysis (SCA).

SCA adalah jenis *security testing* dimana *tool* akan menganalisa apakah kode program menggunakan *library* (langsung maupun tidak langsung) yang mengandung celah keamanan.  Bila kode program yang ditulis oleh programmer sudah "benar" dan "aman", namun *library* atau *framework* aplikasi yang dipakai memiliki celah keamanan, tentu saja pada akhirnya aplikasi tidak aman.

Berikut ini adalah contoh hasil *scan* Snyk pada sebuah proyek Spring Boot di IntelliJ IDEA:

![Tampilan Plugin Snyk Di IntelliJ IDEA]({{ "/assets/images/gambar_00076.png" | relative_url}}){:class="img-fluid rounded"}

Pada hasil di atas, plugin Snyk menampilkan hasil SAC di bagian **Open Source Security**.  Terlihat bahwa proyek ini memakai banyak *dependency* lama yang memiliki masalah keamanan dengan prioritas tinggi (*high*).  Salah satunya adalah *library* ORM Hibernate 5.4.17 yang memiliki celah keamanan SQL Injection.  Selain **Open Source Security**, juga terdapat bagian **Code Security** yang berisi informasi celah keamanan pada kode program dan **Code Quality** yang berisi saran untuk meningkatkan kualitas kode program.

*Tool* otomatis tidak selalu sempurna dan tidak bisa menggantikan analisa dari manusia.  Sebagai contoh, pada hasil *scan* Snyk di atas, terdapat peringatan di bagian **Code Security** karena saya memakai `@CrossOrigin("*")` yang membolehkan *front-end* dari domain apa saja untuk memanggil back-end Spring Boot ini.  Namun, ini sebenarnya memang apa yang hendak saya capai: *endpoint* di method ini khusus dipakai oleh publik.  Untuk *endpoint* lainnya, saya sudah melakukan konfigurasi secara global di *bean* `CorsConfigurationSource` yang memanggil `CorsConfiguration.setAllowedOrigins()` dengan nama domain *front-end* saya.  Dengan demikian, sesungguhnya tidak ada masalah keamanan di sini.

### Dynamic Application Security Testing (DAST) 

Kebalikan dari SAST, DAST adalah *black-box testing* yang tidak perlu mengakses kode program.  Dengan demikian, *tool* DAST sama sekali tidak dibatasi oleh bahasa pemograman dan teknologi yang dipakai untuk membangun aplikasi.  *Tool* DAST akan mengakses *front-end* dan mensimulasikan serangan, misalnya dengan mengirim masukan yang mengandung injeksi (untuk mendeteksi SQL Injection, XSS, dan sebagainya).  Karena *tool* ini melakukan serangan secara langsung, ia hanya dipakai untuk server *staging* atau *testing* (bila ada).  Bayangkan bila *tool* menyuntikkan SQL yang berhasil menghapus seluruh isi database dan ini dilakukan di server *production* :)

Salah satu *tool* yang populer untuk melakukan DAST adalah [OWASP Zed Attack Proxy (ZAP)](https://zaproxy.org).  Biasanya OWASP ZAP dipakai dengan menggunakan [OWASP ZAP Desktop](https://zaproxy.org/docs/desktop) yang merupakan aplikasi *desktop* berbasis Java.  OWASP ZAP Desktop sering dipakai untuk *penetration testing* (tersedia sebagai aplikasi bawaan di Kali Linux).  Setelah membuka aplikasi *desktop* tersebut, pengguna mengetikkan URL yang hendak di-akses dan men-klik tombol untuk membuka *browser* yang dikendalikan oleh OWASP ZAP.  Setiap kali pengguna berpindah halaman, ZAP Proxy akan menganalisa halaman baru tersebut.  Walaupun mudah dipakai untuk *penetration testing*, tentu saja cara manual seperti ini tidak cocok untuk di-integrasi-kan pada *pipeline* CI/CD.

OWASP ZAP memiliki fitur *spider* untuk mencari URL secara otomatis (dengan melakukan *crawling*).  Ini lebih tepat dipakai untuk CI/CD.  Namun, salah satu masalah yang sering saya alami saat melakukan pengujian otomatis adalah *authentication*.  OWASP ZAP akan mengalami kesulitan melakukan *login* pada OAuth2 sehingga fitur *spider*-nya tidak akan pernah bisa melewati halaman login yang sebenarnya bukan bagian dari aplikasi yang hendak diuji.

Solusi paling mudah adalah dengan mematikan fitur *authentication* (berdasarkan rekomendasi di <https://zaproxy.org/docs/authentication/make-your-life-easier/>.  Oleh sebab itu, saya perlu men-*deploy* sebuah aplikasi baru dari *repository* yang sama, namun dengan fasilitas *authentication* yang telah dimatikan.  Lagipula, walaupun *authentication* tidak dimatikan, saya tetap perlu men-*deploy* aplikasi yang berbeda dengan isi database yang berbeda agar pengujian DAST tidak merusak data yang ada di *production*.

Karena di aplikasi yang saya uji, fitur *authentication* ditangani Kong Ingress Controller, saya dapat mematikan *authentication* di *back-end* cukup dengan menghilang `app-jwt-plugin` pada *annotations* `konghq.com/plugins` di seluruh Ingress yang ada.  Saya bisa mengotomatisasikan proses ini, misalnya dengan mengkonfigurasikan *pipeline* CI/CD supaya men-*deploy* dua versi aplikasi yang berbeda: dengan *authentication* dan tanpa *authentication*.   Saat men-*deploy* versi tanpa *authentication*, saya dapat menggunakan function `set-annotations` dari Kpt untuk menghilangkan `app-jwt-plugin` di Ingress.

Di sisi *front-end*, saya dapat membuat sebuah konfigurasi Angular baru, misalnya `environment.noauth.ts` yang memiliki nilai `auth` berupa `false` seperti:

```json
export const environment = {
  production: true,
  auth: false,
  ...
};
```

Saya kemudian membuat `AuthService` yang akan mengabaikan operasi seperti `logoff()` dan mengembalikan nama user yang di-*hardcode* bila nilai `auth` adalah `false` seperti pada contoh berikut ini:

```typescript
@Injectable({
  providedIn: 'root'
})
export class AuthService {

    private oidcSecurityService: OidcSecurityService|null;

    constructor(private injector: Injector) {
        this.oidcSecurityService = environment.auth ? injector.get(OidcSecurityService) : null;    
    }

    getUserData(): Observable<UserDataResult> {
        if (this.oidcSecurityService) {
            return this.oidcSecurityService.userData$;
        } else {
            return of({
                userData: {
                    preferred_username: 'demo_user',
                    email: 'demo@jocki.me',
                },
                allUserData: []
            });
        }
    }

    logoff() {
        if (this.oidcSecurityService != null) {
            this.oidcSecurityService.logoff();
        }
    }

    getAccessToken() {    
        return this.oidcSecurityService?.getAccessToken() ?? '';
    }

}
```

Sekarang, bila ingin men-*build* aplikasi *front-end* yang tidak membutuhkan *authentication*, saya cukup memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>ng build --configuration noauth</code>

Saya kemudian dapat melakukan konfigurasi pada *pipeline* CI/CD supaya menghasilkan dua *image* Docker dengan *tag* berbeda, misalnya yang di-*build* dengan `--configuration noauth` memiliki *tag* seperti `latihan-k8s-angular-web:noauth-edge`.  Saya akan memakai *image* ini di *namespace* Kubernetes dimana fitur *authentication*-nya ingin dimatikan.

Untuk memakai OWASP ZAP di GitHub Actions, saya dapat menggunakan *action* resmi seperti [OWASP ZAP Baseline Scan](https://github.com/marketplace/actions/owasp-zap-baseline-scan), [OWASP ZAP Full Scan](https://github.com/marketplace/actions/owasp-zap-full-scan), atau [OWASP ZAP API Scan](https://github.com/marketplace/actions/owasp-zap-api-scan).  GitHub Action tersebut membutuhkan nilai `target` berupa URL yang akan diuji.

Saya juga dapat memakai *image* Docker `owasp/zap2docker-stable` yang telah disediakan oleh OWASP ZAP bila ingin menjalankan pengujian DAST dari CI/CD *tool* lain.  Sebagai contoh, untuk menjalankan pengujian secara lokal, saya dapat memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>ng serve --configuration noauth --host 0.0.0.0</code>

> <strong>$</strong> <code>docker run -t owasp/zap2docker-stable zap-full-scan.py -t http://172.17.0.1:4200</code>

```
Total of 11 URLs
PASS: Directory Browsing [0]
PASS: Vulnerable JS Library [10003]
PASS: Cookie No HttpOnly Flag [10010]
PASS: Cookie Without Secure Flag [10011]
PASS: Incomplete or No Cache-control Header Set [10015]
...
FAIL-NEW: 0	FAIL-INPROG: 0	WARN-NEW: 6	WARN-INPROG: 0	INFO: 0	IGNORE: 0	PASS: 49
```

### Interactive Application Security Testing (IAST)

Bila dilihat dari cara kerjanya, IAST mirip seperti DAST: selama pengujian, aplikasi harus aktif dan dapat di-akses.  Salah satu kelemahan DAST adalah karena ia diakses dari eksternal oleh sebuah *tool* yang mewakili pengguna, ia tidak memiliki informasi tentang kode program yang sedang dikerjakan.  Bila *tool* mendeteksi celah keamanan, ia hanya bisa menambahkan informasi seperti URL, *request*/*response*, dan sebagainya. *Tool* DAST tidak dapat menunjukkan baris kode program mana yang bermasalah dan perlu diperbaiki.  Sebagai kebalikannya, *tool* SAST dapat menunjukkan secara persis kode program mana yang bermasalah dan merekomendasikan perbaikannya.

*Tool* IAST berusaha menggabungkan SAST dan DAST.  Pada saat menggunakan *tool* IAST, aplikasi perlu menambahkan instrumentasi tertentu (tergantung pada vendor) seperti menambahkan *library* milik vendor dan menulis beberapa baris kode program yang melakukan inisialisasi.  Berkat instrumentasi ini, IAST dapat melakukan lebih banyak analisa dan memberikan informasi yang lebih berguna saat menemukan celah keamanan.  Bila instrumentasi ini tidak dimatikan di *production*, *tool* IAST akan terus bekerja mendeteksi celah keamanan saat aplikasi dipakai oleh pengguna.

Karena tidak berhasil mendapatkan *tool* IAST yang bisa dipakai secara gratis dan mendukung registrasi dari email pribadi, saya tidak tahu seperti apa implementasi IAST, seberapa akurat hasilnya, apa dampak instrumentasi pada kinerja aplikasi, dan sebagainya.

### Cloud Security Posture Management (CSPM)

CSPM adalah kategori *tool* yang dapat dipakai untuk mendeteksi masalah keamanan pada konfigurasi di *cloud platform*.  CSPM juga biasanya dipakai untuk *cloud compliance*.  Salah satu *tool* CSPM yang *open source* adalah [CloudSploit](https://github.com/aquasecurity/cloudsploit).  *Tool* ini mendukung *cloud platform* populer seperti Alibaba, AWS, Azure, GCP, dan OCI.  Untuk *compliance*, CloudSploit mendukung Health Insurance Portability and Accountability Act of 1996 (HIPAA), Payment Card Industry Data Security Standard (PCI DSS), dan CIS Benchmarks Level 1 & Level 2.

Karena tidak menemukan *binary* siap pakai di *repository* dan juga *image* resmi di DockerHub, saya akan menjalankan CloudSploit secara langsung dari kode programnya di *branch* `master`.  CloudSploit ditulis dengan menggunakan JavaScript, jadi saya perlu memastikan bahwa Node.js sudah ter-install di komputer saya.  Setelah itu, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>git clone https://github.com/aquasecurity/cloudsploit.git</code>

> <strong>$</strong> <code>cd cloudsploit</code>

> <strong>$</strong> <code>npm install</code>

> <strong>$</strong> <code>chmod +x index.js</code>

Sebelum menjalankan `index.js`, saya perlu membuat sebuah *service account* di proyek GCP yang hendak di-*scan*.  Saya dapat melakukannya dengan langkah-langkah seperti berikut ini:

1. Buka menu **IAM & Admin** dari Google Cloud Console dan pilih **Service Accounts**.
1. Isi nama *service account* dengan nilai berupa `csm-security-audit` (boleh apa saja).
1. Klik tombol **Done**.
1. Pastikan terdapat nama `csm-security-audit` dari daftar *service account* yang muncul.  Klik nama *service account* tersebut.
1. Buka tab **Keys** dan klik tombol **Add Key**, **Create New Key**.  Pilih **JSON** dan klik tombol **Create**.
1. Buka file yang di-*download* dan salin isinya ke *clipboard*.

Saya kemudian membuat sebuah file baru dengan nama `config.js` yang isinya seperti berikut ini:

```javascript
// CloudSploit config file
module.exports = {
    credentials: {
    	alibaba: {},
        aws: {},
        aws_remediate: {},
        azure: {},
        azure_remediate: {},
        google: {
    	    "project": "nama_proyek_gcp",
            "private_key": "<salin dari file service account>",
            "client_email": "<salin dari file service account>",
        },
        oracle: {},
        github: {}
    }
};
```

Di property `google`, saya mengisi `project` dengan nama proyek GCP yang hendak di-*scan*.  Nilai `private_key` dan `client_email` dapat diambil dari isi file *service account* yang barusan saya download.

Selanjutnya, saya akan memberikan *permission* pada *service account* tersebut supaya mendapatkan hak akses baca ke seluruh *resources* yang ada.  Untuk itu, saya melakukan langkah-langkah berikut ini di Google Cloud Console:

1. Buka menu **IAM & Admin**, **IAM**.
1. Klik tombol **Add**.
1. Isi nilai *Principal* dengan nama *service account* yang buat (seperti `csmp-security-audit@nama-proyek.iam.gserviceaccount.com`).  Tambahkan *Role* berupa **Viewer**.
1. Klik tombol **Save**.

<div class="alert alert-info" role="alert">
Untuk konfigurasi yang lebih granunal, saya dapat mengikuti petunjuk di halaman <a href="https://github.com/aquasecurity/cloudsploit/blob/master/docs/gcp.md">https://github.com/aquasecurity/cloudsploit/blob/master/docs/gcp.md</a>.  Namun saya menemukan beberapa kesalahan di dokumentasi tersebut (pada saat tulisan ini dibuat) seperti nilai <code>includedPermissions</code> seharusnya tanpa tanda kurang (<code>-</code>) dan berada di-identasi yang setara dengan <code>name</code> dan <code>title</code> untuk langkah 3.  Selain itu, pada langkah 4, bila proyek GCP bukan bagian <em>organization</em>, saya perlu mengganti <code>--organization=YOUR_ORGANIZATION_ID</code> menjadi <code>--project=nama_proyek_gcp_saya</code>.  Walaupun demikian, saat saya mencobanya, perintah ini tetap gagal karena beberapa <em>permission</em> tidak dikenali.
</div>

Sekarang, saya siap untuk memulai *scanning* proyek GCP.  Untuk itu, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>./index.js --compliance=pci --config ./config.js --cloud google --junit result-pci.xml</code>

```
   _____ _                 _  _____       _       _ _   
  / ____| |               | |/ ____|     | |     (_) |  
 | |    | | ___  _   _  __| | (___  _ __ | | ___  _| |_ 
 | |    | |/ _ \| | | |/ _` |\___ \| '_ \| |/ _ \| | __|
 | |____| | (_) | |_| | (_| |____) | |_) | | (_) | | |_ 
  \_____|_|\___/ \__,_|\__,_|_____/| .__/|_|\___/|_|\__|
                                   | |                  
                                   |_|                  

  CloudSploit by Aqua Security, Ltd.
  Cloud security auditing for AWS, Azure, GCP, Oracle, and GitHub

INFO: Using CloudSploit config file: ./config.js
INFO: Using compliance modes: pci
INFO: Skipping AWS pagination mode
INFO: Determining API calls to make...
DEBUG: Skipping plugin Open Cassandra because it is not used for compliance programs
DEBUG: Skipping plugin Open DNS because it is not used for compliance programs
DEBUG: Skipping plugin Open Docker because it is not used for compliance programs
DEBUG: Skipping plugin Open SSH because it is not used for compliance programs
...
INFO: Found 19 API calls to make for google plugins
INFO: Collecting metadata. This may take several minutes...
INFO: Metadata collection complete. Analyzing...
INFO: Analysis complete. Scan report to follow...
INFO: JUnit file written to result-pci.xml

  
  │ Cat │ Plugi │         Description         │ Resource   │ Reg │ Sta │           Message            │                           Compliance                            │
  │ ego │   n   │                             │            │ ion │ tus │                              │                                                                 │
  │ ry  │       │                             │            │     │     │                              │                                                                 │
 
  │ VPC │ Exces │ Determines if there are an  │ N/A        │ glo │ OK  │ Acceptable number of         │ PCI: PCI has strict requirements to segment networks using      │
  │ Net │ sive  │ excessive number of         │            │ bal │     │ firewall rules: 4 rules      │ firewalls. Firewall Rules are a software-layer firewall that    │
  │ wor │ Firew │ firewall rules in the       │            │     │     │ present                      │ should be used to isolate resources. Ensure the number of       │
  │ k   │ all   │ account                     │            │     │     │                              │ groups does not become unmanageable.                            │
  │     │ Rules │                             │            │     │     │                              │                                                                 │

  │ VPC │ Open  │ Determines if all ports are │ N/A        │ glo │ OK  │ No public open ports found   │ PCI: PCI has explicit requirements around firewalled access to  │
  │ Net │ All   │ open to the public          │            │ bal │     │                              │ systems. Firewalls should be properly secured to prevent access │
  │ wor │ Ports │                             │            │     │     │                              │ to backend services.                                            │
  │ k   │       │                             │            │     │     │                              │                                                                 │
  
  │ VPC │ Defau │ Determines whether the      │            │ glo │ OK  │ Default VPC is not in use    │ PCI: PCI has explicit requirements around default accounts and  │
  │ Net │ lt    │ default VPC is being used   │            │ bal │     │                              │ resources. PCI recommends removing all default accounts, only   │
  │ wor │ VPC   │ for launching VM instances  │            │     │     │                              │ enabling necessary services as required for the function of the │
  │ k   │ In    │                             │            │     │     │                              │ system                                                          │
  │     │ Use   │                             │            │     │     │                              │                                                                 │
  
  │ VPC │ Flow  │ Ensures VPC flow logs are   │            │ us- │ FAI │ The subnet does not have     │ PCI: PCI requires logging of all network access to environments │
  │ Net │ Logs  │ enabled for traffic logging │            │ eas │ L   │ flow logs enabled            │ containing cardholder data. Enable VPC flow logs to log these   │
  │ wor │ Enabl │                             │            │ t1  │     │                              │ network requests.                                               │
  │ k   │ ed    │                             │            │     │     │                              │                                                                 │
  
  │ VPC │ Priva │ Ensures Private Google      │            │ us- │ FAI │ Subnet does not have Private │ PCI: PCI recommends implementing additional security features   │
  │ Net │ te    │ Access is enabled for all   │            │ eas │ L   │ Google Access Enabled        │ for any required service. This includes using secured           │
  │ wor │ Acces │ Subnets                     │            │ t1  │     │                              │ technologies such as Private Google Access.                     │
  │ k   │ s     │                             │            │     │     │                              │                                                                 │
  │     │ Enabl │                             │            │     │     │                              │                                                                 │
  │     │ ed    │                             │            │     │     │                              │                                                                 │
  
  │ Com │ OS    │ Ensures OS login is enabled │            │ glo │ OK  │ OS login is enabled by       │ PCI: PCI recommends implementing additional security features   │
  │ put │ Login │ for the project             │            │ bal │     │ default                      │ for any required service. This includes using secured           │
  │ e   │ Enabl │                             │            │     │     │                              │ technologies such as SSH.                                       │
  │     │ ed    │                             │            │     │     │                              │                                                                 │
  
  │ SQL │ DB    │ Ensures SQL instances can   │            │ glo │ OK  │ SQL instance has backup      │ PCI: PCI requires that security procedures, including           │
  │     │ Resto │ be restored to a recent     │            │ bal │     │ available                    │ restoration of compromised services, be tested frequently. RDS  │
  │     │ rable │ point                       │            │     │     │                              │ restorable time indicates the last known time to which the      │
  │     │       │                             │            │     │     │                              │ instance can be restored.                                       │
  
  │ SQL │ DB    │ Ensures that SQL instances  │            │ glo │ OK  │ SQL Instance is not publicly │ PCI: PCI requires backend services to be properly firewalled.   │
  │     │ Publi │ do not allow public access  │            │ bal │     │ accessible                   │ Ensure SQL instances are not accessible from the Internet and   │
  │     │ cly   │                             │            │     │     │                              │ use proper jump box access mechanisms.                          │
  │     │ Acces │                             │            │     │     │                              │                                                                 │
  │     │ sible │                             │            │     │     │                              │                                                                 │     
  ...
INFO: Scan complete 
```

Pada perintah di atas, saya menggunakan `--compliance=pci` untuk memeriksa apakah konfigurasi proyek GCP tersebut sudah sesuai dengan standar PCI DSS.  Nilai `--config ./config.js` merujuk pada file konfigurasi yang saya buat sebelumnya (pastikan untuk diawali dengan tanda titik).  Selain itu, saya menambahkan `--junit result-pci.xml` supaya CloudSploit juga menulis hasil pengujian pada file `result-pci.xml` (di folder yang sama) dalam format JUnit. Saya kemudian dapat membuka file ini di IntelliJ IDEA seperti yang terlihat pada gambar berikut ini:

![Tampilan Hasil Scan Di JUnit]({{ "/assets/images/gambar_00077.png" | relative_url}}){:class="img-fluid rounded"}

Terlihat bahwa proyek GCP yang saya *scan* masih memiliki 132 item yang masih tidak memenuhi aturan di PCI DSS seperti koneksi database SQL tidak menggunakan SSL, beberapa *service account* memiliki *key* yang usianya lebih dari 90 hari (tidak dirotasi), tidak ada *log alert* bila terjadi perubahan *project ownership*, dan sebagainya.  