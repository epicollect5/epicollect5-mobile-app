<?php

namespace ec5\Services\Project;

use DB;
use ec5\DTO\ProjectDTO;
use ec5\DTO\ProjectRoleDTO;
use ec5\Models\Project\Project;
use ec5\Models\Project\ProjectRole;
use ec5\Models\Project\ProjectStats;
use ec5\Models\Project\ProjectStructure;
use ec5\Models\User\User;
use Exception;
use Log;
use Throwable;

class ProjectService
{
    /**
     * Recursively sanitize jumps in an input and its nested branch and group inputs.
     *
     * @param array &$input
     * @return void
     */
    private function sanitizeJumpsInInput(array &$input): void
    {
        // Sanitize jumps at this input level
        if (isset($input['jumps']) && is_array($input['jumps'])) {
            foreach ($input['jumps'] as $jumpIndex => $jump) {
                // Remove 'has_valid_destination' if present
                if (isset($jump['has_valid_destination'])) {
                    unset($input['jumps'][$jumpIndex]['has_valid_destination']);
                }
                // Set answer_ref to null if needed
                if (
                    isset($jump['to'], $jump['when']) &&
                    $jump['to'] === 'END' &&
                    $jump['when'] === 'ALL' &&
                    (!isset($jump['answer_ref']) || $jump['answer_ref'] === '')
                ) {
                    $input['jumps'][$jumpIndex]['answer_ref'] = null;
                }
            }
        }

        // Recursively sanitize branch inputs
        if (isset($input['branch']) && is_array($input['branch'])) {
            foreach ($input['branch'] as &$branchInput) {
                $this->sanitizeJumpsInInput($branchInput);
            }
        }

        // Recursively sanitize group inputs
        if (isset($input['group']) && is_array($input['group'])) {
            foreach ($input['group'] as &$groupInput) {
                $this->sanitizeJumpsInInput($groupInput);
            }
        }
    }
    /**
     * @throws Throwable
     */
    public function storeProject(ProjectDTO $project)
    {
        try {
            DB::beginTransaction();

            $projectDefinition = $project->getProjectDefinition();
            $projectExtra = $project->getProjectExtra();
            $projectMapping = $project->getProjectMapping();
            $projectStats = $project->getProjectStats();
            $projectDetails = $project->getProjectDetails();
            $projectRef = $projectDetails['ref'] ?? null;

            if (empty($projectRef)) {
                throw new Exception('Project ref is empty');
            }

            $projectStored = new Project();
            $projectStored->name = $projectDetails['name'];
            $projectStored->slug = $projectDetails['slug'];
            $projectStored->ref = $projectDetails['ref'];
            $projectStored->description = $projectDetails['description'];
            $projectStored->small_description = $projectDetails['small_description'];
            $projectStored->access = $projectDetails['access'];
            $projectStored->visibility = $projectDetails['visibility'];
            $projectStored->category = $projectDetails['category'];
            $projectStored->created_by = $projectDetails['created_by'];
            $projectStored->can_bulk_upload = $projectDetails['can_bulk_upload'];
            $didSaveProject = $projectStored->save();

            if (!$didSaveProject) {
                throw new Exception('Project could not be saved');
            }

            //add the project role
            $projectRoleStored = new ProjectRole([
                'project_id' => $projectStored->id,
                'user_id' => $projectStored->created_by,
                'role' => config('epicollect.strings.project_roles.creator')
            ]);
            $didSaveProjectRole = $projectRoleStored->save();
            if (!$didSaveProjectRole) {
                throw new Exception('Project role could not be saved');
            }

            // Insert project stats
            $statsData = $projectStats->toJsonEncoded();
            $statsData['project_id'] = $projectStored->id;

            // Insert project details get back insert_id
            $projectStatsStored = new ProjectStats($statsData);
            $didSaveProjectStats = $projectStatsStored->save();

            if (!$didSaveProjectStats) {
                throw new Exception('Project stats could not be saved');
            }

            // Insert project JSON structures
            $structureData['project_id'] = $projectStored->id;
            $structureData['project_definition'] = $projectDefinition->getJsonData();
            $structureData['project_extra'] = $projectExtra->getJsonData();
            $structureData['project_mapping'] = $projectMapping->getJsonData();

            $projectStructureStored = new ProjectStructure($structureData);
            $didSaveProjectStructure = $projectStructureStored->save();

            if (!$didSaveProjectStructure) {
                throw new Exception('Project structure could not be saved');
            }
            // All good
            DB::commit();
            return $projectStored->id;
        } catch (Exception  $e) {
            Log::error(__METHOD__ . ' failed.', ['exception' => $e->getMessage()]);
            DB::rollBack();
            return 0;
        }
    }

    /**
     * Function for retrieving paginated project users
     * Optional search criteria can be passed through
     * This will either return an array of sets of users
     * indexed 'manager', 'curator', 'collector',
     * or just the users for one set.
     *
     * @param int $perPage
     * @param string $search
     * @param array $params
     * @return array
     */
    public function getProjectMembersPaginated(int $perPage = 1, string $search = '', array $params = array()): array
    {
        $users = [];

        // loop round and gather users for each set of roles
        foreach ($params['roles'] as $role) {

            // retrieve all project users where role is $role
            $userSet = DB::table(config('epicollect.tables.users'))
                ->select('users.id', 'users.name', 'users.last_name', 'users.email', 'project_roles.role')
                ->join('project_roles', 'users.id', '=', 'project_roles.user_id')
                ->where('project_roles.project_id', '=', $params['project_id'])
                ->where('project_roles.role', '=', $role)
                ->where(function ($query) use ($search) {
                    // if we have search criteria, add to where clause
                    if (!empty($search)) {
                        $query->where('users.name', 'LIKE', '%' . $search . '%')
                            ->orWhere('users.email', 'LIKE', '%' . $search . '%');
                    }
                })
                ->orderBy('users.name', 'asc');

            // now paginate users
            // setting the 'page' variable name relative to the $role
            $users[$role] = $userSet->simplePaginate($perPage, ['*'], 'page-' . $role);
        }
        return $users;
    }

    /**
     * Populate and return a ProjectRole object for user/project
     *
     * @param User|null $user
     * @param $projectId
     * @return ProjectRoleDTO
     */
    public function getRole($projectId, ?User $user = null): ProjectRoleDTO
    {
        $projectRoleUser = new ProjectRoleDTO();
        $role = null;
        // If we have a valid user
        if ($user && $user->id) {
            $projectRole = DB::table('project_roles')
                ->select('role')
                ->where('user_id', '=', $user->id)
                ->where('project_id', '=', $projectId)
                ->first();
            // If a project role is found, set
            if ($projectRole) {
                $role = $projectRole->role;
            }
        }
        // Set the project role and return
        $projectRoleUser->setRole($user, $projectId, $role);
        return $projectRoleUser;
    }

    /**
     * @throws Throwable
     */
    public function cloneProjectRoles($projectIdFrom, $projectIdTo): bool
    {
        try {
            DB::beginTransaction();
            //remove all roles from destination project
            //there should be only the CREATOR role at this point
            ProjectRole::where('project_id', $projectIdTo)->delete();

            //copy roles from the source project
            $projectRoles = ProjectRole::where('project_id', $projectIdFrom)->get();
            foreach ($projectRoles as $projectRole) {
                // Try and insert to the destination project
                $row = new ProjectRole([
                    'user_id' => $projectRole->user_id,
                    'project_id' => $projectIdTo,
                    'role' => $projectRole->role
                ]);
                $roleSaved = $row->save();
                if (!$roleSaved) {
                    throw new Exception('Cannot save role');
                }
            }

            DB::commit();
            return true;
        } catch (Throwable $e) {
            Log::error(__METHOD__ . ' failed.', ['exception' => $e->getMessage()]);
            DB::rollBack();
            return false;
        }
    }

    //Only add the user if it is not a member of the project

    /**
     * @throws Throwable
     */
    public function addOrUpdateUserRole($userId, $projectId, $role): bool
    {
        try {
            DB::beginTransaction();
            $userToAddRole = ProjectRole::where('user_id', $userId)
                ->where('project_id', $projectId)
                ->first();

            if ($userToAddRole) {
                //the user with the provided email is already a member of the project
                //just update its role as it has passed the validation above
                $wasUserUpdated = $userToAddRole->update(['role' => $role]);
                if (!$wasUserUpdated) {
                    throw new Exception('Cannot add or update user role ');
                }

            } else {
                // Create the project role for this user
                $projectRole = new ProjectRole([
                    'user_id' => $userId,
                    'project_id' => $projectId,
                    'role' => $role
                ]);
                $wasUserAdded = $projectRole->save();
                if (!$wasUserAdded) {
                    throw new Exception('Cannot add or update user role ');
                }
            }
            DB::commit();
            return true;
        } catch (Throwable $e) {
            Log::error(__METHOD__ . ' failed.', ['exception' => $e->getMessage()]);
            DB::rollBack();
            return false;
        }
    }

    public function sanitiseProjectDefinitionForExport(array $projectDefinition): array
    {
        //[BUG] trim new lines form descriptions as these can cause issues with export and import
        $projectDefinition['project']['small_description'] = trim($projectDefinition['project']['small_description']);
        $projectDefinition['project']['description'] = trim($projectDefinition['project']['description']);

        // [BUG] where small description is too short on old projects, add '_' to make it valid
        $smallDescriptionMinLength = config('epicollect.limits.project.small_desc.min');
        // Use multibyte-safe length check and padding to support UTF-8 languages
        $smallDesc = $projectDefinition['project']['small_description'];
        if (mb_strlen($smallDesc, 'UTF-8') < $smallDescriptionMinLength) {
            $needed = $smallDescriptionMinLength - mb_strlen($smallDesc, 'UTF-8');
            // Pad with ASCII underscores (single-byte) to reach the required character count
            $projectDefinition['project']['small_description'] = $smallDesc . str_repeat('_', $needed);
        }

        $smallDescriptionMinLength = config('epicollect.limits.project.form.name.min');
        // Use multibyte-safe length check and padding to support UTF-8 languages
        $smallDesc = $projectDefinition['project']['small_description'];
        if (mb_strlen($smallDesc, 'UTF-8') < $smallDescriptionMinLength) {
            $needed = $smallDescriptionMinLength - mb_strlen($smallDesc, 'UTF-8');
            // Pad with ASCII underscores (single-byte) to reach the required character count
            $projectDefinition['project']['small_description'] = $smallDesc . str_repeat('_', $needed);
        }

        //[BUG] where small description has invalid characters, replace with '_'
        $projectDefinition['project']['small_description'] = str_replace(
            ['<', '>'],
            '_',
            $projectDefinition['project']['small_description']
        );

        // [BUG] where some descriptions have invisible/whitespace characters, these must be replaced with a normal space
        $projectDefinition['project']['small_description'] = preg_replace('/\s+/u', ' ', $projectDefinition['project']['small_description']);
        $projectDefinition['project']['description'] = preg_replace('/\s+/u', ' ', $projectDefinition['project']['description']);

        if (!isset($projectDefinition['project']['forms']) || !is_array($projectDefinition['project']['forms'])) {
            return $projectDefinition;
        }

        foreach ($projectDefinition['project']['forms'] as $formIndex => $form) {
            // [BUG] sanitise form name to remove any invisible/whitespace characters
            if (isset($form['name'])) {
                $projectDefinition['project']['forms'][$formIndex]['name'] = preg_replace('/\s+/u', ' ', $form['name']);
            }

            if (!isset($form['inputs']) || !is_array($form['inputs'])) {
                continue;
            }

            foreach ($form['inputs'] as $inputIndex => $input) {
                // [BUG] where group has inputs when the question is branch, it should be an empty array
                if (
                    isset($input['type']) &&
                    $input['type'] === config('epicollect.strings.inputs_type.branch')
                ) {
                    $projectDefinition['project']['forms'][$formIndex]['inputs'][$inputIndex]['group'] = [];
                }

                // Recursively sanitize jumps in this input (including nested branch/group)
                $this->sanitizeJumpsInInput($projectDefinition['project']['forms'][$formIndex]['inputs'][$inputIndex]);

                // [BUG] sanitise min and max for decimal inputs to ensure leading zero
                $this->sanitizeDecimalInInput($projectDefinition['project']['forms'][$formIndex]['inputs'][$inputIndex]);
            }
        }

        return $projectDefinition;
    }

    /**
     * Sanitize decimal value to ensure it has a leading zero if missing.
     * E.g., .5 becomes 0.5, -.78 becomes -0.78
     *
     * @param mixed $value
     * @return mixed
     */
    private function sanitizeDecimalValue(mixed $value): mixed
    {
        if (is_string($value) && preg_match('/^(-?)\.(\d+)$/', $value, $matches)) {
            return $matches[1] . '0.' . $matches[2];
        }
        return $value;
    }

    /**
     * Recursively sanitize decimal min and max in an input and its nested branch and group inputs.
     *
     * @param array &$input
     * @return void
     */
    private function sanitizeDecimalInInput(array &$input): void
    {
        if (isset($input['type']) && $input['type'] === config('epicollect.strings.inputs_type.decimal')) {
            if (isset($input['min'])) {
                $input['min'] = $this->sanitizeDecimalValue($input['min']);
            }
            if (isset($input['max'])) {
                $input['max'] = $this->sanitizeDecimalValue($input['max']);
            }
        }

        // Sanitize branch inputs
        if (isset($input['branch']) && is_array($input['branch'])) {
            foreach ($input['branch'] as &$branchInput) {
                $this->sanitizeDecimalInInput($branchInput);
            }
        }

        // Sanitize group inputs
        if (isset($input['group']) && is_array($input['group'])) {
            foreach ($input['group'] as &$groupInput) {
                $this->sanitizeDecimalInInput($groupInput);
            }
        }
    }
}
