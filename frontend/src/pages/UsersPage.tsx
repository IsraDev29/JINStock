import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useAuth, type Rol } from '../context/AuthContext';
import { cacheUsersLocally, getCachedUsers } from '../services/syncService';

export interface UserAccount {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  estado: boolean;
  verificado?: boolean;
  createdAt?: string;
}

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'TODOS' | 'ADMINISTRADOR' | 'CAJERO'>('TODOS');

  // Form fields (M-02: Solo roles existentes en el alcance: ADMINISTRADOR y CAJERO)
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'CAJERO' as Rol,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // --- Estado: Modal Reset Contraseña (Admin) ---
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // --- Estado: Modal Cambiar Mi Contraseña ---
  const [isChangeOwnOpen, setIsChangeOwnOpen] = useState(false);
  const [ownCurrentPwd, setOwnCurrentPwd] = useState('');
  const [ownNewPwd, setOwnNewPwd] = useState('');
  const [ownConfirmPwd, setOwnConfirmPwd] = useState('');
  const [showOwnCurrent, setShowOwnCurrent] = useState(false);
  const [showOwnNew, setShowOwnNew] = useState(false);
  const [showOwnConfirm, setShowOwnConfirm] = useState(false);
  const [ownError, setOwnError] = useState<string | null>(null);
  const [ownSuccess, setOwnSuccess] = useState<string | null>(null);
  const [ownLoading, setOwnLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setActionError(null);
    const online = navigator.onLine;
    setIsOffline(!online);

    if (!online) {
      // Modo offline: mostrar usuarios cacheados de la última sesión online
      const cached = await getCachedUsers();
      if (cached.length > 0) {
        setUsers(cached as any);
      } else {
        setActionError('Sin conexión. No hay usuarios cacheados disponibles.');
      }
      setLoading(false);
      return;
    }

    const res = await apiFetch<UserAccount[]>('/users');
    if (res.success && res.data) {
      setUsers(res.data);
      // Cachear para uso offline futuro
      cacheUsersLocally(res.data).catch(() => {});
    } else {
      // Intentar mostrar caché si la API falla
      const cached = await getCachedUsers();
      if (cached.length > 0) {
        setUsers(cached as any);
        setActionError('No se pudo conectar al servidor. Mostrando datos en caché.');
      } else {
        setActionError(res.message || 'Error al obtener usuarios.');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleUserStatus = async (usr: UserAccount) => {
    setActionError(null);
    const res = await apiFetch(`/users/${usr.id}/status`, { method: 'PATCH' });
    if (res.success) {
      fetchUsers();
    } else {
      setActionError(res.message || 'Error al cambiar estado del usuario.');
    }
  };

  const handleDeleteUser = async (usr: UserAccount) => {
    setActionError(null);
    if (usr.id === user?.id) {
      setActionError('No puede eliminar su propia cuenta de administrador.');
      return;
    }
    const confirmed = window.confirm(
      `¿Está seguro de que desea eliminar permanentemente al usuario "${usr.nombre}" (${usr.email})?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const res = await apiFetch(`/users/${usr.id}`, { method: 'DELETE' });
    if (res.success) {
      fetchUsers();
    } else {
      setActionError(res.message || 'Error al eliminar usuario.');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formData.nombre.trim() || !formData.email.trim() || !formData.password) {
      setFormError('Por favor complete todos los campos obligatorios.');
      return;
    }

    const res = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    if (res.success) {
      setFormSuccess('Usuario creado exitosamente con credenciales activas.');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormData({ nombre: '', email: '', password: '', rol: 'CAJERO' });
        fetchUsers();
      }, 600);
    } else {
      setFormError(res.message || 'Error al registrar el usuario.');
    }
  };

  // --- Handler: Admin resetea contraseña de otro usuario ---
  const openResetModal = (usr: UserAccount) => {
    setResetTarget(usr);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError(null);
    setResetSuccess(null);
    setShowResetNew(false);
    setShowResetConfirm(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!resetNewPassword || resetNewPassword.length < 8) {
      setResetError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Las contraseñas no coinciden.');
      return;
    }

    setResetLoading(true);
    const res = await apiFetch(`/users/${resetTarget!.id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword: resetNewPassword }),
    });
    setResetLoading(false);

    if (res.success) {
      setResetSuccess(res.message || 'Contraseña actualizada correctamente.');
      setTimeout(() => setResetTarget(null), 1200);
    } else {
      setResetError(res.message || 'Error al actualizar la contraseña.');
    }
  };

  // --- Handler: Usuario cambia su propia contraseña ---
  const openChangeOwnModal = () => {
    setOwnCurrentPwd('');
    setOwnNewPwd('');
    setOwnConfirmPwd('');
    setOwnError(null);
    setOwnSuccess(null);
    setShowOwnCurrent(false);
    setShowOwnNew(false);
    setShowOwnConfirm(false);
    setIsChangeOwnOpen(true);
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnError(null);
    setOwnSuccess(null);

    if (!ownCurrentPwd) {
      setOwnError('Ingrese su contraseña actual.');
      return;
    }
    if (!ownNewPwd || ownNewPwd.length < 8) {
      setOwnError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (ownNewPwd !== ownConfirmPwd) {
      setOwnError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setOwnLoading(true);
    const res = await apiFetch('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: ownCurrentPwd, newPassword: ownNewPwd }),
    });
    setOwnLoading(false);

    if (res.success) {
      setOwnSuccess('¡Contraseña actualizada correctamente!');
      setTimeout(() => setIsChangeOwnOpen(false), 1400);
    } else {
      setOwnError(res.message || 'Error al actualizar la contraseña.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-white flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-4xl text-rose-400 mb-2">lock</span>
        <h2 className="text-xl font-bold">Acceso Restringido</h2>
        <p className="text-xs text-gray-400 mt-1">
          Solo los usuarios con rol de <strong>Administrador</strong> tienen acceso a la gestión de colaboradores.
        </p>
        {/* Botón para que el cajero cambie su propia contraseña */}
        <button
          onClick={openChangeOwnModal}
          className="mt-4 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">lock_reset</span>
          Cambiar mi contraseña
        </button>

        {isChangeOwnOpen && (
          <ChangeOwnPasswordModal
            onClose={() => setIsChangeOwnOpen(false)}
            onSubmit={handleChangeOwnPassword}
            ownCurrentPwd={ownCurrentPwd} setOwnCurrentPwd={setOwnCurrentPwd}
            ownNewPwd={ownNewPwd} setOwnNewPwd={setOwnNewPwd}
            ownConfirmPwd={ownConfirmPwd} setOwnConfirmPwd={setOwnConfirmPwd}
            showOwnCurrent={showOwnCurrent} setShowOwnCurrent={setShowOwnCurrent}
            showOwnNew={showOwnNew} setShowOwnNew={setShowOwnNew}
            showOwnConfirm={showOwnConfirm} setShowOwnConfirm={setShowOwnConfirm}
            ownError={ownError} ownSuccess={ownSuccess} ownLoading={ownLoading}
          />
        )}
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (activeFilter === 'TODOS') return true;
    return u.rol === activeFilter;
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto font-body text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-purple-400 text-3xl">admin_panel_settings</span>
            Gestión de Usuarios y Roles
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Administración de cuentas con acceso al sistema (Roles: ADMINISTRADOR y CAJERO según especificación).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openChangeOwnModal}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">lock_reset</span>
            Mi Contraseña
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setFormData({ nombre: '', email: '', password: '', rol: 'CAJERO' });
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/30"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Nuevo Colaborador
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl border bg-red-950/70 border-red-500/40 text-red-200 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {isOffline && (
        <div className="p-3 rounded-xl border bg-amber-950/60 border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">wifi_off</span>
          <span>Modo sin conexión — mostrando datos de la última sincronización. Las acciones de crear/editar no están disponibles.</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">Total Usuarios</span>
            <span className="text-2xl font-extrabold text-white block mt-1">{users.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <span className="material-symbols-outlined">group</span>
          </div>
        </div>

        <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">Administradores</span>
            <span className="text-2xl font-extrabold text-purple-300 block mt-1">
              {users.filter((u) => u.rol === 'ADMINISTRADOR').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <span className="material-symbols-outlined">shield_person</span>
          </div>
        </div>

        <div className="bg-[#1c1b22] border border-[#2d2c35] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">Cajeros de Turno</span>
            <span className="text-2xl font-extrabold text-emerald-400 block mt-1">
              {users.filter((u) => u.rol === 'CAJERO').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <span className="material-symbols-outlined">badge</span>
          </div>
        </div>
      </div>

      {/* Role Filter Tabs (M-02) */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {(['TODOS', 'ADMINISTRADOR', 'CAJERO'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeFilter === filter
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-[#1c1b22] text-gray-400 hover:text-white border border-[#2d2c35]'
            }`}
          >
            {filter === 'TODOS' ? 'Todos los Usuarios' : filter === 'ADMINISTRADOR' ? 'Administradores' : 'Cajeros'}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-[#1c1b22] border border-[#2d2c35] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Cargando usuarios...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-gray-500 text-xs">
            No se encontraron usuarios en este rol.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14131a] text-gray-400 border-b border-white/5 uppercase font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Correo Electrónico</th>
                  <th className="py-3 px-4 text-center">Rol Asignado</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((usr) => (
                  <tr key={usr.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-800 flex items-center justify-center font-bold text-xs text-white">
                          {usr.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-white leading-tight">{usr.nombre}</p>
                          <span className="text-[10px] text-gray-500">
                            Registrado: {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString('es-NI', { timeZone: 'America/Managua' }) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300 font-mono text-xs">{usr.email}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          usr.rol === 'ADMINISTRADOR'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {usr.rol}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          usr.estado
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {usr.estado ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleToggleUserStatus(usr)}
                          disabled={usr.id === user?.id}
                          title={usr.id === user?.id ? 'No puede desactivar su propia cuenta' : 'Cambiar estado'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            usr.estado
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {usr.estado ? 'Desactivar' : 'Activar'}
                        </button>
                        {/* Botón: Resetear contraseña (Admin) */}
                        <button
                          onClick={() => openResetModal(usr)}
                          title="Resetear contraseña"
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">lock_reset</span>
                          <span>Contraseña</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(usr)}
                          disabled={usr.id === user?.id}
                          title={usr.id === user?.id ? 'No puede eliminar su propia cuenta' : 'Eliminar usuario permanentemente'}
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Registrar Nuevo Colaborador */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">person_add</span>
                Registrar Nuevo Colaborador
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Roberto Martínez García"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ejemplo@jinstock.ni"
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">Contraseña Inicial *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres..."
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 pr-10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* M-02: Selector de Rol (Exclusivamente ADMINISTRADOR o CAJERO) */}
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Rol Operativo *</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as Rol })}
                  className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="CAJERO">CAJERO (Acceso exclusivo a POS y Mis Ventas)</option>
                  <option value="ADMINISTRADOR">ADMINISTRADOR (Acceso total al sistema y reportes)</option>
                </select>
                <span className="text-[11px] text-gray-500 block mt-1">
                  Nota: Roles adicionales (Bodega, Contador) quedan declarados fuera del alcance según las especificaciones del MVP.
                </span>
              </div>

              <div className="flex gap-2 pt-3 border-t border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl font-semibold text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md transition-colors"
                >
                  Guardar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resetear contraseña (Admin sobre otro usuario) */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">lock_reset</span>
                Resetear Contraseña
              </h3>
              <button onClick={() => setResetTarget(null)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Establecer nueva contraseña para{' '}
              <span className="text-white font-bold">{resetTarget.nombre}</span>{' '}
              <span className="font-mono text-gray-500">({resetTarget.email})</span>
            </p>

            {resetError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">{resetError}</div>
            )}
            {resetSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Nueva Contraseña *</label>
                <div className="relative">
                  <input
                    type={showResetNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 pr-10 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => setShowResetNew(!showResetNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">{showResetNew ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-400 font-semibold block mb-1">Confirmar Contraseña *</label>
                <div className="relative">
                  <input
                    type={showResetConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="Repita la contraseña"
                    className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 pr-10 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => setShowResetConfirm(!showResetConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">{showResetConfirm ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-white/10 mt-2">
                <button type="button" onClick={() => setResetTarget(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl font-semibold text-gray-300">
                  Cancelar
                </button>
                <button type="submit" disabled={resetLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                  {resetLoading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-base">save</span>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cambiar propia contraseña */}
      {isChangeOwnOpen && (
        <ChangeOwnPasswordModal
          onClose={() => setIsChangeOwnOpen(false)}
          onSubmit={handleChangeOwnPassword}
          ownCurrentPwd={ownCurrentPwd} setOwnCurrentPwd={setOwnCurrentPwd}
          ownNewPwd={ownNewPwd} setOwnNewPwd={setOwnNewPwd}
          ownConfirmPwd={ownConfirmPwd} setOwnConfirmPwd={setOwnConfirmPwd}
          showOwnCurrent={showOwnCurrent} setShowOwnCurrent={setShowOwnCurrent}
          showOwnNew={showOwnNew} setShowOwnNew={setShowOwnNew}
          showOwnConfirm={showOwnConfirm} setShowOwnConfirm={setShowOwnConfirm}
          ownError={ownError} ownSuccess={ownSuccess} ownLoading={ownLoading}
        />
      )}
    </div>
  );
};

// --- Componente reutilizable: Modal Cambiar Propia Contraseña ---
interface ChangeOwnPasswordModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  ownCurrentPwd: string; setOwnCurrentPwd: (v: string) => void;
  ownNewPwd: string; setOwnNewPwd: (v: string) => void;
  ownConfirmPwd: string; setOwnConfirmPwd: (v: string) => void;
  showOwnCurrent: boolean; setShowOwnCurrent: (v: boolean) => void;
  showOwnNew: boolean; setShowOwnNew: (v: boolean) => void;
  showOwnConfirm: boolean; setShowOwnConfirm: (v: boolean) => void;
  ownError: string | null;
  ownSuccess: string | null;
  ownLoading: boolean;
}

const ChangeOwnPasswordModal: React.FC<ChangeOwnPasswordModalProps> = ({
  onClose, onSubmit,
  ownCurrentPwd, setOwnCurrentPwd,
  ownNewPwd, setOwnNewPwd,
  ownConfirmPwd, setOwnConfirmPwd,
  showOwnCurrent, setShowOwnCurrent,
  showOwnNew, setShowOwnNew,
  showOwnConfirm, setShowOwnConfirm,
  ownError, ownSuccess, ownLoading,
}) => (
  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-[#1c1b22] border border-[#2d2c35] w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-400">lock_reset</span>
          Cambiar Mi Contraseña
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {ownError && (
        <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">{ownError}</div>
      )}
      {ownSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          {ownSuccess}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-xs">
        <div>
          <label className="text-gray-400 font-semibold block mb-1">Contraseña Actual *</label>
          <div className="relative">
            <input
              type={showOwnCurrent ? 'text' : 'password'}
              required
              value={ownCurrentPwd}
              onChange={(e) => setOwnCurrentPwd(e.target.value)}
              placeholder="Su contraseña actual"
              className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 pr-10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button type="button" onClick={() => setShowOwnCurrent(!showOwnCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              <span className="material-symbols-outlined text-[20px]">{showOwnCurrent ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        <div>
          <label className="text-gray-400 font-semibold block mb-1">Nueva Contraseña *</label>
          <div className="relative">
            <input
              type={showOwnNew ? 'text' : 'password'}
              required
              minLength={8}
              value={ownNewPwd}
              onChange={(e) => setOwnNewPwd(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 pr-10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button type="button" onClick={() => setShowOwnNew(!showOwnNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              <span className="material-symbols-outlined text-[20px]">{showOwnNew ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        <div>
          <label className="text-gray-400 font-semibold block mb-1">Confirmar Nueva Contraseña *</label>
          <div className="relative">
            <input
              type={showOwnConfirm ? 'text' : 'password'}
              required
              minLength={8}
              value={ownConfirmPwd}
              onChange={(e) => setOwnConfirmPwd(e.target.value)}
              placeholder="Repita la nueva contraseña"
              className="w-full bg-[#100f14] border border-[#2d2c35] rounded-xl px-3 py-2 pr-10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button type="button" onClick={() => setShowOwnConfirm(!showOwnConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              <span className="material-symbols-outlined text-[20px]">{showOwnConfirm ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-white/10 mt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl font-semibold text-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={ownLoading}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2">
            {ownLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-base">save</span>}
            Actualizar
          </button>
        </div>
      </form>
    </div>
  </div>
);
