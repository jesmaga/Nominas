document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            // Generar hash MD5 en cliente (como hacías antes)
            const passwordHash = CryptoJS.MD5(password).toString();

            try {
                // Petición al servidor
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, passwordHash })
                });

                const data = await response.json();

                if (data.success) {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('loggedInUser', data.user);
                    window.location.href = 'Index.html'; // O index.html según como lo renombraste
                } else {
                    errorMessage.textContent = "Usuario o contraseña incorrectos";
                    errorMessage.classList.remove('hidden');
                }
            } catch (error) {
                console.error(error);
                errorMessage.textContent = "Error de conexión con el servidor";
                errorMessage.classList.remove('hidden');
            }
        });
    }
});