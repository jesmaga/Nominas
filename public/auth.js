document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // Limpiamos mensajes de error al escribir
    if(loginForm) {
        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                errorMessage.classList.add('hidden');
            });
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            // Generamos el hash MD5 igual que antes, pero ahora lo enviamos al servidor
            // Asegúrate de que CryptoJS está cargado en tu login.html
            const passwordHash = CryptoJS.MD5(password).toString();

            // Deshabilitar botón para evitar doble click
            const btn = loginForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = "Verificando...";
            btn.disabled = true;

            try {
                // PETICIÓN AL SERVIDOR (NEON DB)
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, passwordHash })
                });

                const data = await response.json();

                if (data.success) {
                    // Login correcto
                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('loggedInUser', data.user); // Guardamos quién entró
                    
                    // IMPORTANTE: Redirigimos a index.html (en minúsculas si lo renombraste)
                    window.location.href = 'index.html'; 
                } else {
                    // Contraseña incorrecta o usuario no existe en BD
                    errorMessage.textContent = "Usuario o contraseña incorrectos.";
                    errorMessage.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Error de login:", error);
                errorMessage.textContent = "Error de conexión con el servidor.";
                errorMessage.classList.remove('hidden');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
});