To generate localhost SSL certificate do this:
Following tutorial: https://gist.github.com/joshlawton/3e365673a09262b6604873f6cbc99bad

On MAC:
1. Run:
brew install mkcert
2. Continue from Step 3. for windows

On Windows:
1. Install Scoop: https://scoop.sh/
2. Run in PowerShell:
scoop bucket add extras
scoop install mkcert
3. cd to the /server/ssl-certificates folder
4. Type in: mkcert -key-file dev-key.pem -cert-file dev-cert.pem -install localhost 127.0.0.1
5. Place both files in server/ssl-certificates
6. Create a .vscode folder, inside create a settings.json and paste following code:
{
    "liveServer.settings.https": {
        "enable": true, //set it true to enable the feature.
        "cert": "C:\\Users\\newha\\Desktop\\rabb.it\\server\\ssl-certificates\\dev-cert.pem", // full path of the certificate
        "key": "C:\\Users\\newha\\Desktop\\rabb.it\\server\\ssl-certificates\\dev-key.pem", // full path of the private key
        "passphrase": ""
    }
}


To get live server cerficicates (when hosting):
1. Go to your hosting provider and open the CPanel.
2. Click "SSL/TLS Status"
3. Find the domain and select "View SSL certificate"
4. Scroll down and you shall find the CRT, KEY and CABUNDLE fields.
5. Create a file for each and place them inside /server/ssl-certificates/.
File names must be:
live-ca.pem - CA Bundle (CABUNDLE)
live-cert.pem - Certificate (CRT)
live-key.pem - Private key (KEY)