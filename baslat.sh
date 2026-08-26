#!/bin/bash
# HaYTool Youtube Download - CachyOS & Unix Masaüstü Başlatıcı Betiği
# Yapımcı: HaYTo
# İletişim: korazhayto@gmail.com

# Çalışma dizinini betiğin bulunduğu dizin olarak ayarla
cd "$(dirname "$0")"

# --- Bağımlılık Kontrolleri (Akıllı Başlatma - Kural 22) ---
if ! command -v node >/dev/null 2>&1; then
    echo -e "\e[31m[HATA] Node.js sisteminizde kurulu değil!\e[0m"
    echo -e "\e[33mLütfen CachyOS/Arch Linux için terminalde şu komutu çalıştırarak Node.js kurun:\e[0m"
    echo -e "  sudo pacman -S nodejs npm"
    echo ""
    read -p "Çıkmak için Enter'a basın..."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "\e[31m[HATA] NPM paket yöneticisi sisteminizde kurulu değil!\e[0m"
    echo -e "\e[33mLütfen CachyOS/Arch Linux için NPM kurun (sudo pacman -S npm).\e[0m"
    echo ""
    read -p "Çıkmak için Enter'a basın..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "\e[36m[BİLGİ] 'node_modules' klasörü bulunamadı. Gerekli kütüphaneler ilk kez kuruluyor...\e[0m"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "\e[31m[HATA] Kütüphane kurulumu başarısız oldu. Lütfen internet bağlantınızı kontrol edin.\e[0m"
        read -p "Çıkmak için Enter'a basın..."
        exit 1
    fi
    echo -e "\e[32m[BAŞARILI] Tüm kütüphaneler başarıyla kuruldu.\e[0m"
    echo ""
fi
# ---------------------------------------------------------

# configunix.ini dosyasından port değerini dinamik olarak okur, bulamazsa varsayılan 4141 portunu kullanır.
PORT=4141
CONFIG_FILE="configunix.ini"
if [ -f "$CONFIG_FILE" ]; then
    PORT_VAL=$(grep -i '^port[[:space:]]*=' "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
    if [ ! -z "$PORT_VAL" ]; then
        PORT=$PORT_VAL
    fi
fi

# Belirlenen portun başka bir süreç tarafından kullanılıp kullanılmadığını denetler.
PORT_PID=$(lsof -t -i:$PORT 2>/dev/null)
if [ -z "$PORT_PID" ]; then
    PORT_PID=$(fuser $PORT/tcp 2>/dev/null | tr -d ' ')
fi

if [ ! -z "$PORT_PID" ]; then
    PNAME=$(ps -p $PORT_PID -o comm= 2>/dev/null)
    echo -e "\e[31m  ====================================================\e[0m"
    echo -e "\e[31m  [UYARI] Port $PORT şu anda başka bir işlem tarafından kullanılıyor!\e[0m"
    echo -e "\e[31m  İşlem ID (PID): $PORT_PID\e[0m"
    echo -e "\e[31m  Uygulama Adı  : $PNAME\e[0m"
    echo -e "\e[31m  ====================================================\e[0m"
    echo ""
    echo "  [1] İşlemi sonlandır (kill -9) ve sunucuyu başlat"
    echo "  [2] İşlemi sonlandırma ve çık"
    echo ""
    read -p "  Seçiminiz (1 veya 2): " CHOICE

    if [ "$CHOICE" = "1" ]; then
        echo ""
        echo -e "  \e[33m[+] Portu kullanan işlem ($PNAME - PID: $PORT_PID) sonlandırılıyor...\e[0m"
        kill -9 $PORT_PID
        sleep 2
        clear
    else
        echo ""
        echo -e "  \e[31m[-] Port çakışması giderilmedi. Uygulama başlatılamıyor.\e[0m"
        exit 1
    fi
fi

# Başlangıç ekranı logoları ve bilgileri
echo -e "\e[33m  ====================================================\e[0m"
echo -e "\e[33m  _    _         __     __ _______  ___   ___   _     \e[0m"
echo -e "\e[33m | |  | |  __ _  \\ \\   / /|__   __|/ _ \\ / _ \\ | |    \e[0m"
echo -e "\e[33m | |__| | / _\` |  \\ \\_/ /    | |  | (_) | (_) || |    \e[0m"
echo -e "\e[33m |  __  || (_| |   \\   /     | |   \\___/ \\___/ | |    \e[0m"
echo -e "\e[33m | |  | | \\__,_|    | |      | |               | |____\e[0m"
echo -e "\e[33m |_|  |_|           |_|      |_|               |______|\e[0m"
echo ""
echo -e "\e[33m             -- Premium Otomasyonu --\e[0m"
echo -e "\e[33m             Versiyon: v9.8.6 (CachyOS & Unix)\e[0m"
echo -e "\e[33m  ====================================================\e[0m"
echo ""
echo -e "  \e[32m[+] Sunucu Port: $PORT denetleniyor...\e[0m"
echo -e "  \e[32m[+] Masaüstü Pencere Modu (App Mode) Hazırlanıyor...\e[0m"
echo -e "  \e[32m[+] Kapatmak için pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.\e[0m"
echo ""
echo -e "  \e[34m----------------------------------------------------\e[0m"
echo -e "  \e[34m[Sistem] HaYTooL Arayüzü Başlatılıyor...\e[0m"
echo -e "  \e[34m----------------------------------------------------\e[0m"
echo ""

# Arka planda tarayıcıyı Standalone App Mode olarak tetikle
(
  sleep 2
  URL="http://localhost:$PORT"
  if command -v cachy-browser >/dev/null 2>&1; then
      cachy-browser --app="$URL" >/dev/null 2>&1 &
  elif command -v google-chrome >/dev/null 2>&1; then
      google-chrome --app="$URL" >/dev/null 2>&1 &
  elif command -v chromium >/dev/null 2>&1; then
      chromium --app="$URL" >/dev/null 2>&1 &
  elif command -v brave >/dev/null 2>&1; then
      brave --app="$URL" >/dev/null 2>&1 &
  elif command -v zen-browser >/dev/null 2>&1; then
      zen-browser --app="$URL" >/dev/null 2>&1 &
  elif command -v firefox >/dev/null 2>&1; then
      firefox --new-window "$URL" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$URL" >/dev/null 2>&1 &
  else
      echo -e "\e[31m  [UYARI] Sistemde tarayıcı bulunamadı. Lütfen 'http://localhost:$PORT' adresini tarayıcınızda açın.\e[0m"
  fi
) &

# Uygulama sunucusunu başlat
npm start
