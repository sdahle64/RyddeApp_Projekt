const Database = require("better-sqlite3");
const db = new Database("hashes.db");
const bcrypt = require("bcrypt");

async function tryBcrypt(){
    const password = "mysecretpassword";

    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    console.log("Hash 1:", hash1);
    console.log("Hash 2:", hash2);

    console.log(
        await bcrypt.compare(password, hash1)
    );

    console.log(
        await bcrypt.compare("FeilPassord", hash1)
    )
}

tryBcrypt();