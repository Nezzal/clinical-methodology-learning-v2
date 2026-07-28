const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

// Fonction pour charger .env.local dans process.env
function loadEnv() {
  const searchPaths = [
    path.join(__dirname, '.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(path.dirname(process.execPath), '.env.local')
  ];

  try {
    if (app) {
      searchPaths.push(path.join(app.getPath('userData'), '.env.local'));
    }
  } catch (e) {
    // Électron n'est pas encore prêt ou app.getPath n'est pas disponible
  }

  for (const envPath of searchPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`📝 [Electron] Chargement des variables d'environnement depuis : ${envPath}`);
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split('=');
            if (parts.length >= 2) {
              const key = parts[0].trim();
              const val = parts.slice(1).join('=').trim();
              // Ne pas écraser si déjà défini dans l'environnement système global
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        });
        break; // Premier fichier trouvé et chargé
      } catch (err) {
        console.error(`❌ [Electron] Erreur de lecture de ${envPath}:`, err);
      }
    }
  }
}

// Charger l'environnement
loadEnv();

let mainWindow = null;
let nextServerProcess = null;
const isDev = process.env.ELECTRON_DEV === '1';
const DEFAULT_PORT = 3001;

// Trouver un port réseau libre
function findFreePort(startPort, callback) {
  let port = startPort;
  const server = net.createServer();
  server.listen(port, () => {
    server.once('close', () => {
      callback(port);
    });
    server.close();
  });
  server.on('error', () => {
    findFreePort(port + 1, callback);
  });
}

// Vérifier si le serveur Next.js est prêt
function checkServerReady(port, callback, attempts = 0) {
  if (attempts > 150) { // 15 secondes max
    console.error("❌ Timeout : Le serveur Next.js n'a pas démarré.");
    callback(false);
    return;
  }

  const req = http.get(`http://localhost:${port}/`, (res) => {
    callback(true);
  });

  req.on('error', () => {
    setTimeout(() => {
      checkServerReady(port, callback, attempts + 1);
    }, 100);
  });
}

function startNextServer(port) {
  if (isDev) {
    console.log('🚀 Mode développement : Connexion au serveur de développement sur le port', port);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log('📦 Démarrage du serveur Next.js autonome...');
    
    // Résolution du chemin du serveur autonome Next.js
    let serverPath = path.join(__dirname, '.next/standalone/server.js');
    
    // Si l'application est packagée sous forme d'ASAR, les ressources se trouvent dans app.asar.unpacked
    if (serverPath.includes('app.asar')) {
      serverPath = serverPath.replace('app.asar', 'app.asar.unpacked');
    }

    console.log(`- Chemin du serveur : ${serverPath}`);

    // Lancement de server.js en utilisant l'exécutable d'Electron en mode interpréteur Node (ELECTRON_RUN_AS_NODE = 1)
    nextServerProcess = spawn(process.execPath, [serverPath], {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: port.toString(),
        HOSTNAME: 'localhost',
        NODE_ENV: 'production'
      },
      stdio: 'pipe'
    });

    nextServerProcess.stdout.on('data', (data) => {
      console.log(`[Next.js Server]: ${data.toString().trim()}`);
    });

    nextServerProcess.stderr.on('data', (data) => {
      console.error(`[Next.js Server Error]: ${data.toString().trim()}`);
    });

    nextServerProcess.on('error', (err) => {
      console.error('❌ Échec du démarrage du serveur Next.js :', err);
      reject(err);
    });

    // Attendre que le serveur réponde
    checkServerReady(port, (ready) => {
      if (ready) {
        console.log(`✅ Serveur Next.js démarré avec succès sur http://localhost:${port}`);
        resolve();
      } else {
        reject(new Error("Le serveur Next.js n'a pas répondu à temps."));
      }
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: 'Plateforme RECIF - Méthodo-Clinique',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    // Design moderne
    titleBarStyle: 'default',
    autoHideMenuBar: true // Cache le menu sous Windows (accessible avec Alt)
  });

  const url = `http://localhost:${port}`;
  mainWindow.loadURL(url);
  mainWindow.show();
  mainWindow.focus();

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Verrou d'instance unique (Empêche d'avoir deux applications Electron en parallèle)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log("⚠️ Une instance de RECIF-MethodoClinique est déjà en cours d'exécution. Fermeture du doublon.");
  app.quit();
} else {
  app.on('second-instance', () => {
    // Si l'utilisateur tente d'ouvrir une 2ème fois, on ramène la 1ère fenêtre au premier plan
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Démarrage de l'application
app.whenReady().then(() => {
  if (isDev) {
    createWindow(DEFAULT_PORT);
  } else {
    findFreePort(3001, (freePort) => {
      startNextServer(freePort)
        .then(() => {
          createWindow(freePort);
        })
        .catch((err) => {
          console.error("❌ Impossible de démarrer l'application :", err);
          app.quit();
        });
    });
  }
});

// Arrêt propre du processus enfant Next.js à la fermeture d'Electron
function cleanUp() {
  if (nextServerProcess) {
    console.log('🛑 Arrêt du serveur Next.js...');
    try {
      nextServerProcess.kill('SIGKILL');
    } catch (e) {}
    nextServerProcess = null;
  }
}

app.on('activate', () => {
  if (mainWindow !== null) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    findFreePort(3001, (freePort) => {
      startNextServer(freePort).then(() => createWindow(freePort));
    });
  }
});

app.on('window-all-closed', () => {
  cleanUp();
  app.quit();
});

app.on('will-quit', () => {
  cleanUp();
});

process.on('exit', () => {
  cleanUp();
});
