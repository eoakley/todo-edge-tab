document.addEventListener('DOMContentLoaded', function() {
    // Carregar tarefas salvas quando o popup abrir
    loadTasks();

    // Adicionar tarefa quando o botão for clicado
    $('#addTask').click(addTask);

    // Adicionar tarefa quando Enter for pressionado
    $('#taskInput').keypress(function(e) {
        if (e.which == 13) {
            addTask();
        }
    });

    function addTask() {
        const taskInput = $('#taskInput');
        const taskText = taskInput.val().trim();
        
        if (taskText) {
            // Criar novo item da lista
            const taskItem = createTaskElement(taskText);
            
            // Adicionar à lista
            $('#taskList').append(taskItem);
            
            // Limpar input
            taskInput.val('');
            
            // Salvar tarefas
            saveTasks();
        }
    }

    function createTaskElement(taskText) {
        const li = $('<li>').addClass('task-item');
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .addClass('task-checkbox')
            .click(function() {
                textSpan.toggleClass('completed');
                saveTasks();
            });
        const textSpan = $('<span>').text(taskText);
        const deleteBtn = $('<button>')
            .addClass('delete-btn')
            .text('Excluir')
            .click(function() {
                li.fadeOut(300, function() {
                    li.remove();
                    saveTasks();
                });
            });

        li.append(checkbox, textSpan, deleteBtn);
        return li;
    }

    function saveTasks() {
        const tasks = [];
        $('#taskList li').each(function() {
            tasks.push({
                text: $(this).find('span').text(),
                completed: $(this).find('span').hasClass('completed')
            });
        });
        
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log('Tarefas salvas:', tasks);
    }

    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        tasks.forEach(function(task) {
            const taskItem = createTaskElement(task.text);
            if (task.completed) {
                taskItem.find('.task-checkbox').prop('checked', true);
                taskItem.find('span').addClass('completed');
            }
            $('#taskList').append(taskItem);
        });
    }
}); 