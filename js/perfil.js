document.addEventListener('DOMContentLoaded', async () => {
    if (typeof ensureAuthenticated === 'function') {
        const ok = await ensureAuthenticated();
        if (!ok) return;
    }

    const profileForm = document.getElementById('profile-form');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const bioInput = document.getElementById('bio');
    const profileName = document.querySelector('.profile-meta h2');
    const profileEmail = document.querySelector('.profile-meta .page-subtitle');

    // Função para carregar os dados do utilizador
    async function loadUserData() {
        try {
            const response = await authFetch('/api/user');
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            const user = await response.json();

            firstNameInput.value = user.firstName || '';
            lastNameInput.value = user.lastName || '';
            emailInput.value = user.email || '';
            phoneInput.value = user.phone || '';
            bioInput.value = user.bio || '';
            profileName.textContent = `${user.firstName} ${user.lastName}`;
            profileEmail.textContent = user.email;

        } catch (error) {
            console.error('Error loading user data:', error);
            // Opcional: redirecionar para o login se não estiver autenticado
            // window.location.href = '/login.html';
        }
    }

    // Função para guardar as alterações
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const updatedUser = {
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            email: emailInput.value,
            phone: phoneInput.value,
            bio: bioInput.value,
        };

        try {
            const response = await authFetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedUser),
            });

            if (!response.ok) {
                throw new Error('Failed to save user data');
            }

            const result = await response.json();
            alert(result.message || 'Changes saved successfully!');
            
            // Atualizar o cabeçalho do perfil
            profileName.textContent = `${updatedUser.firstName} ${updatedUser.lastName}`;
            profileEmail.textContent = updatedUser.email;

        } catch (error) {
            console.error('Error saving user data:', error);
            alert('Error saving changes. Please try again.');
        }
    });

    // Carregar os dados do utilizador quando a página é carregada
    loadUserData();
});
