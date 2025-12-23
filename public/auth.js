document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // --- Cargar usuarios desde localStorage ---
    let users = [];
    const storedUsers = localStorage.getItem('appUsers'); // Key must match where you save in index.html

    if (storedUsers) {
        try {
            users = JSON.parse(storedUsers);
            console.log("Usuarios cargados desde localStorage:", users); // For debugging
        } catch (e) {
            console.error("Error parsing users from localStorage:", e);
            // Fallback: If parsing fails, maybe create a default admin
            // users = [{ username: 'admin', passwordHash: 'YOUR_ADMIN_HASH_HERE' }];
            // localStorage.setItem('appUsers', JSON.stringify(users)); // Save the default
            alert("Error al cargar la lista de usuarios. Contacte al administrador.");
            return; // Stop execution if users can't be loaded
        }
    } else {
        // Optional: Create default users if none exist (like the first time)
        console.log("No users found in localStorage. Creating default admin.");
        users = [{ username: 'admin', passwordHash: '482c811da5d5b4bc6d497ffa98491e38' }]; // Example: admin/password123
        localStorage.setItem('appUsers', JSON.stringify(users));
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const enteredUsername = usernameInput.value.trim(); // Trim username input
        const enteredPassword = passwordInput.value;

        // Buscar al usuario en la lista cargada
        const user = users.find(u => u.username === enteredUsername);

        if (user) {
            // Si el usuario existe, hashear la contraseña introducida
            const enteredPasswordHash = CryptoJS.MD5(enteredPassword).toString();
             console.log("Entered Hash:", enteredPasswordHash); // For debugging

            // Comparar el hash introducido con el almacenado para ESE usuario
            if (enteredPasswordHash === user.passwordHash) {
                // ¡Éxito!
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('loggedInUser', user.username);
                errorMessage.classList.add('hidden');
                window.location.href = 'index.html';
            } else {
                // Contraseña incorrecta
                showLoginError();
            }
        } else {
            // Usuario no encontrado
            showLoginError();
        }
    });

    function showLoginError() {
        errorMessage.classList.remove('hidden');
        document.getElementById('password').value = ''; // Limpiar contraseña
    }
});