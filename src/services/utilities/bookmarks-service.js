
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseSelectService } from '@/services/database/database-select-service';

export const bookmarksService = {

    //Check whether a page is bookmarked already 
    getBookmarkId (projectRef, formRef, parentEntryUuid) {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = bookmarkStore.bookmarks;
        let bookmarkId = null;

        bookmarks.forEach((bookmark) => {
            // Check that the project ref and form ref are the same
            if (bookmark.projectRef === projectRef && bookmark.formRef === formRef) {

                // Then check that parent entry uuid is that same as the last object in the 'bookmark' array
                // If the bookmark array is empty, then we are at the top of a navigation
                if (bookmark.bookmark.length === 0 ||
                    bookmark.bookmark[bookmark.bookmark.length - 1].parentEntryUuid === parentEntryUuid) {
                    bookmarkId = bookmark.id;
                }
            }
        });

        return bookmarkId;
    },
    async insertBookmark (projectRef, formRef, title) {

        const rootStore = useRootStore();
        const bookmarkStore = useBookmarkStore();
        // Check if we have a parent entry uuid and retrieve the most recent one
        let parentEntryUuid = '';
        const hierarchyNavigation = rootStore.hierarchyNavigation;

        const lastBookmark = hierarchyNavigation[hierarchyNavigation.length - 1];
        if (lastBookmark) {
            parentEntryUuid = lastBookmark.parentEntryUuid;
        }

        return new Promise((resolve, reject) => {

            databaseInsertService.insertBookmark(projectRef, formRef, title, JSON.stringify(hierarchyNavigation), parentEntryUuid).then(function (res) {

                //update bookmark store
                bookmarkStore.addBookmark({
                    id: res.insertId,
                    projectRef: projectRef,
                    formRef: formRef,
                    title: title,
                    bookmark: hierarchyNavigation.slice()
                });
                resolve(res.insertId);
            }, function (error) {
                reject(error);
            });
        });
    },
    async deleteBookmark (bookmarkId) {

        const bookmarkStore = useBookmarkStore();

        return new Promise((resolve, reject) => {
            //delete bookmark from database

            databaseDeleteService.deleteBookmark(bookmarkId).then((res) => {
                //update store
                bookmarkStore.deleteBookmark(bookmarkId);
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    },
    //todo: this could be an action in the bookmarks vuex store to be fair
    async getBookmarks () {

        const bookmarks = [];

        return new Promise((resolve, reject) => {

            databaseSelectService.selectBookmarks().then(function (res) {

                if (res.rows.length > 0) {

                    Object.values(res.rows).forEach((row) => {
                        bookmarks.push({
                            id: row.id,
                            projectRef: row.project_ref,
                            formRef: row.form_ref,
                            title: row.title,
                            bookmark: JSON.parse(row.bookmark)
                        });
                    });
                }
                resolve(bookmarks);
            }, function (error) {
                reject(error);
            });
        });
    }
};