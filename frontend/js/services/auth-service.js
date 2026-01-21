/**
 * Servicio de Autenticación
 * Maneja el login, logout y gestión de sesiones de usuarios
 */
class AuthService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Autenticar usuario
     * @param {string} usuario - Nombre de usuario
     * @param {string} password - Contraseña
     * @returns {Promise<object>} Usuario autenticado
     */
    async login(usuario, password) {
        try {
            // En local, validar contra localStorage
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return await this.loginLocal(usuario, password);
            }

            // En producción, validar contra API/DynamoDB
            // TODO: Implementar llamada a Lambda function cuando esté disponible
            return await this.loginLocal(usuario, password);
        } catch (error) {
            console.error('[Auth] Error al autenticar:', error);
            throw error;
        }
    }

    /**
     * Login local (desarrollo)
     */
    async loginLocal(usuario, password) {
        // Obtener usuarios del almacenamiento
        const usuarios = await this.obtenerUsuarios();
        
        // Buscar usuario
        const usuarioEncontrado = usuarios.find(u => 
            u.usuario && u.usuario.toLowerCase() === usuario.toLowerCase()
        );

        if (!usuarioEncontrado) {
            throw new Error('Usuario o contraseña incorrectos');
        }

        // Validar contraseña (en producción usar bcrypt)
        // Por ahora, comparación simple (en producción debe ser hash)
        if (usuarioEncontrado.password !== password) {
            throw new Error('Usuario o contraseña incorrectos');
        }

        if (!usuarioEncontrado.activo) {
            throw new Error('Usuario inactivo');
        }

        // Actualizar último acceso
        usuarioEncontrado.ultimo_acceso = new Date().toISOString();

        // Crear sesión
        const sesion = await this.crearSesion(usuarioEncontrado);

        // Guardar usuario actual
        await this.dataAdapter.setCurrentUser(usuarioEncontrado);

        console.log(`[Auth] Usuario ${usuario} autenticado correctamente`);
        return usuarioEncontrado;
    }

    /**
     * Cerrar sesión
     */
    async logout() {
        try {
            const user = await this.dataAdapter.getCurrentUser();
            
            if (user && user.sesion_id) {
                // Eliminar sesión del almacenamiento
                await this.eliminarSesion(user.sesion_id);
            }

            // Limpiar usuario actual
            await this.dataAdapter.setCurrentUser(null);

            console.log('[Auth] Sesión cerrada');
        } catch (error) {
            console.error('[Auth] Error al cerrar sesión:', error);
        }
    }

    /**
     * Obtener usuario actual
     */
    async getCurrentUser() {
        try {
            return await this.dataAdapter.getCurrentUser();
        } catch (error) {
            console.error('[Auth] Error al obtener usuario actual:', error);
            return null;
        }
    }

    /**
     * Verificar si está autenticado
     */
    async isAuthenticated() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return false;

            // Verificar sesión si existe
            if (user.sesion_id) {
                const sesionValida = await this.validarSesion(user.sesion_id);
                return sesionValida;
            }

            return true; // Si no hay sesion_id, asumir válido (modo local)
        } catch (error) {
            return false;
        }
    }

    /**
     * Verificar rol del usuario
     */
    async hasRole(rol) {
        try {
            const user = await this.getCurrentUser();
            if (!user) return false;
            return user.rol === rol;
        } catch (error) {
            return false;
        }
    }

    /**
     * Crear nueva sesión
     */
    async crearSesion(usuario) {
        try {
            const sesionId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const sesion = {
                id: sesionId,
                usuario_id: usuario.id,
                usuario: usuario.usuario,
                fecha_creacion: new Date().toISOString(),
                fecha_expiracion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
                activa: true
            };

            // Guardar sesión
            await this.guardarSesion(sesion);

            // Asignar sesion_id al usuario
            usuario.sesion_id = sesionId;
            await this.dataAdapter.setCurrentUser(usuario);

            return sesion;
        } catch (error) {
            console.error('[Auth] Error al crear sesión:', error);
            throw error;
        }
    }

    /**
     * Validar sesión
     */
    async validarSesion(sesionId) {
        try {
            const sesiones = await this.obtenerSesiones();
            const sesion = sesiones.find(s => s.id === sesionId && s.activa);

            if (!sesion) {
                return false;
            }

            // Verificar expiración
            const ahora = new Date();
            const expiracion = new Date(sesion.fecha_expiracion);

            if (ahora > expiracion) {
                // Sesión expirada
                sesion.activa = false;
                await this.guardarSesion(sesion);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[Auth] Error al validar sesión:', error);
            return false;
        }
    }

    /**
     * Obtener usuarios del almacenamiento
     */
    async obtenerUsuarios() {
        try {
            // En local, obtener de localStorage
            if (this.dataAdapter.storage && this.dataAdapter.storage.get) {
                const usuariosData = this.dataAdapter.storage.get('usuarios') || {};
                return usuariosData.lista || [];
            }
            return [];
        } catch (error) {
            console.error('[Auth] Error al obtener usuarios:', error);
            return [];
        }
    }

    /**
     * Guardar sesión
     */
    async guardarSesion(sesion) {
        try {
            if (this.dataAdapter.storage && this.dataAdapter.storage.get) {
                const sesiones = this.dataAdapter.storage.get('sesiones') || [];
                const index = sesiones.findIndex(s => s.id === sesion.id);
                
                if (index >= 0) {
                    sesiones[index] = sesion;
                } else {
                    sesiones.push(sesion);
                }

                // Limpiar sesiones expiradas
                const ahora = new Date();
                const sesionesActivas = sesiones.filter(s => {
                    const expiracion = new Date(s.fecha_expiracion);
                    return expiracion > ahora;
                });

                this.dataAdapter.storage.set('sesiones', sesionesActivas);
            }
        } catch (error) {
            console.error('[Auth] Error al guardar sesión:', error);
        }
    }

    /**
     * Obtener sesiones
     */
    async obtenerSesiones() {
        try {
            if (this.dataAdapter.storage && this.dataAdapter.storage.get) {
                return this.dataAdapter.storage.get('sesiones') || [];
            }
            return [];
        } catch (error) {
            console.error('[Auth] Error al obtener sesiones:', error);
            return [];
        }
    }

    /**
     * Eliminar sesión
     */
    async eliminarSesion(sesionId) {
        try {
            if (this.dataAdapter.storage && this.dataAdapter.storage.get) {
                const sesiones = this.dataAdapter.storage.get('sesiones') || [];
                const sesionesActualizadas = sesiones.filter(s => s.id !== sesionId);
                this.dataAdapter.storage.set('sesiones', sesionesActualizadas);
            }
        } catch (error) {
            console.error('[Auth] Error al eliminar sesión:', error);
        }
    }

    /**
     * Guardar usuarios en almacenamiento
     */
    async guardarUsuarios(usuarios) {
        try {
            if (this.dataAdapter.storage && this.dataAdapter.storage.set) {
                this.dataAdapter.storage.set('usuarios', { lista: usuarios });
            }
        } catch (error) {
            console.error('[Auth] Error al guardar usuarios:', error);
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
