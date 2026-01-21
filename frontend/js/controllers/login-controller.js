/**
 * Controlador de Login
 * Maneja la autenticación de usuarios
 */
class LoginController {
    constructor() {
        this.authService = null;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        // Inicializar servicio de autenticación
        this.authService = new AuthService(window.dataAdapter);

        // Verificar si ya está autenticado
        const isAuthenticated = await this.authService.isAuthenticated();
        if (isAuthenticated) {
            // Redirigir según rol
            await this.redirigirSegunRol();
            return;
        }

        // Inicializar usuarios de prueba si no existen
        await this.inicializarUsuariosPrueba();

        this.setupEventListeners();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        const form = document.getElementById('login-form');
        const togglePassword = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('password');
        const passwordIcon = document.getElementById('password-icon');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (togglePassword && passwordInput && passwordIcon) {
            togglePassword.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                passwordIcon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
            });
        }
    }

    /**
     * Manejar login
     */
    async handleLogin() {
        const usuarioInput = document.getElementById('usuario');
        const passwordInput = document.getElementById('password');
        const btnLogin = document.getElementById('btn-login');
        const btnLoginText = document.getElementById('btn-login-text');
        const btnLoginLoading = document.getElementById('btn-login-loading');
        const errorMessage = document.getElementById('error-message');

        if (!usuarioInput || !passwordInput) return;

        const usuario = usuarioInput.value.trim();
        const password = passwordInput.value;

        if (!usuario || !password) {
            this.mostrarError('Por favor completa todos los campos');
            return;
        }

        // Deshabilitar botón y mostrar loading
        if (btnLogin) {
            btnLogin.disabled = true;
            if (btnLoginText) btnLoginText.classList.add('hidden');
            if (btnLoginLoading) btnLoginLoading.classList.remove('hidden');
        }

        // Ocultar error anterior
        if (errorMessage) {
            errorMessage.classList.add('hidden');
        }

        try {
            const user = await this.authService.login(usuario, password);
            
            // Redirigir según rol
            await this.redirigirSegunRol(user);
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            this.mostrarError(error.message || 'Usuario o contraseña incorrectos');
        } finally {
            // Habilitar botón y ocultar loading
            if (btnLogin) {
                btnLogin.disabled = false;
                if (btnLoginText) btnLoginText.classList.remove('hidden');
                if (btnLoginLoading) btnLoginLoading.classList.add('hidden');
            }
        }
    }

    /**
     * Mostrar error
     */
    mostrarError(mensaje) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = mensaje;
            errorMessage.classList.remove('hidden');
        }
    }

    /**
     * Redirigir según rol del usuario
     */
    async redirigirSegunRol(user = null) {
        if (!user) {
            user = await this.authService.getCurrentUser();
        }

        if (!user) {
            return;
        }

        const rol = user.rol || 'area';
        let url = '';

        switch (rol.toLowerCase()) {
            case 'area':
                url = 'Evidencias.html';
                break;
            case 'responsable_cn':
            case 'responsable cn':
                url = 'Dashboard.html';
                break;
            case 'administrador':
            case 'admin':
                url = 'Configuración.html';
                break;
            default:
                url = 'Dashboard.html';
        }

        window.location.href = url;
    }

    /**
     * Inicializar usuarios de prueba (solo en desarrollo)
     */
    async inicializarUsuariosPrueba() {
        try {
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                return; // Solo en desarrollo local
            }

            // Verificar si ya existen usuarios
            const usuarios = await this.authService.obtenerUsuarios();
            if (usuarios && usuarios.length > 0) {
                return; // Ya existen usuarios
            }

            // Crear usuarios de prueba
            const usuariosPrueba = [
                {
                    id: 'usr_area_001',
                    usuario: 'area',
                    password: 'area123', // En producción debe ser hash bcrypt
                    nombre: 'Usuario Área',
                    email: 'area@alertia.com',
                    area: 'Riesgos',
                    rol: 'area',
                    activo: true,
                    ultimo_acceso: null,
                    sesion_id: null
                },
                {
                    id: 'usr_resp_001',
                    usuario: 'responsable',
                    password: 'responsable123',
                    nombre: 'Responsable CN',
                    email: 'responsable.cn@alertia.com',
                    area: 'Cumplimiento Normativo',
                    rol: 'responsable_cn',
                    activo: true,
                    ultimo_acceso: null,
                    sesion_id: null
                },
                {
                    id: 'usr_admin_001',
                    usuario: 'admin',
                    password: 'admin123',
                    nombre: 'Administrador',
                    email: 'admin@alertia.com',
                    area: 'Administración',
                    rol: 'administrador',
                    activo: true,
                    ultimo_acceso: null,
                    sesion_id: null
                }
            ];

            // Guardar usuarios en localStorage
            if (this.authService.dataAdapter.storage && this.authService.dataAdapter.storage.set) {
                this.authService.dataAdapter.storage.set('usuarios', { lista: usuariosPrueba });
                console.log('[Login] Usuarios de prueba inicializados');
            }
        } catch (error) {
            console.warn('[Login] No se pudieron inicializar usuarios de prueba:', error);
        }
    }
}

// Inicializar cuando el DOM esté listo
function initializeLoginController() {
    if (window.dataAdapter && !window.loginController) {
        const controller = new LoginController();
        controller.init();
        window.loginController = controller;
    }
}

// Intentar inicializar inmediatamente o esperar evento
if (window.dataAdapter) {
    initializeLoginController();
} else {
    document.addEventListener('alertia-ready', initializeLoginController);
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeLoginController, 500);
    });
}
