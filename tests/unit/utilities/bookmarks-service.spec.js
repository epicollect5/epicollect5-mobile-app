import { vi } from 'vitest';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { webService } from '@/services/web-service';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model';
import { useDBStore } from '@/stores/db-store';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import flushPromises from 'flush-promises';
import { utilsService } from '@/services/utilities/utils-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseSelectService } from '@/services/database/database-select-service';


const projectRef = '5b71f16947c34ff49b3f24756d2e2ae6';
const formRef = '5b71f16947c34ff49b3f24756d2e2ae6_60817f551ce29';

describe('bookmarksService getBookmarkId', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('returns bookmarks id (or null when no matching bookmark is found) (parent form)', () => {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = [
            {
                id: 11,
                projectRef,
                formRef,
                title: 'The bookmark 1 title',
                hierarchyNavigation: []
            },
            {
                id: 22,
                projectRef: projectRef + '-',
                formRef: formRef + '-',
                title: 'The bookmark 2 title',
                hierarchyNavigation: []
            },
            {
                id: 33,
                projectRef: projectRef + '--',
                formRef: formRef + '--',
                title: 'The bookmark 3 title',
                hierarchyNavigation: []
            }
        ];

        bookmarkStore.addBookmark(bookmarks[0]);
        expect(bookmarkStore.bookmarks.length).toBe(1);
        bookmarkStore.addBookmark(bookmarks[1]);
        expect(bookmarkStore.bookmarks.length).toBe(2);
        bookmarkStore.addBookmark(bookmarks[2]);
        expect(bookmarkStore.bookmarks.length).toBe(3);

        expect(bookmarksService.getBookmarkId(projectRef, formRef, '')).toBe(11);
        expect(bookmarksService.getBookmarkId(projectRef + '-', formRef + '-', '')).toBe(22);
        expect(bookmarksService.getBookmarkId(projectRef + '--', formRef + '--', '')).toBe(33);
        expect(bookmarksService.getBookmarkId(projectRef + '0', formRef + '0', '')).toBe(null);
    });

    it('returns bookmarks id (or null when no matching bookmark is found) (child form, 1 level)', () => {

        const bookmarkStore = useBookmarkStore();
        const parentEntryUuid = utilsService.uuid();
        const bookmarks = [
            {
                id: 11,
                projectRef,
                formRef,
                title: 'The bookmark 1 title',
                hierarchyNavigation: []
            },
            {
                id: 33,
                projectRef: projectRef,
                formRef: formRef,
                title: 'The bookmark 3 title',
                hierarchyNavigation: [
                    {
                        parentEntryUuid,
                        parentEntryName: 'history'
                    }
                ]
            },
            {
                id: 44,
                projectRef: projectRef,
                formRef: formRef,
                title: 'The bookmark 4 title',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: parentEntryUuid + '-',
                        parentEntryName: 'history'
                    }
                ]
            }
        ];

        bookmarkStore.addBookmark(bookmarks[0]);
        expect(bookmarkStore.bookmarks.length).toBe(1);
        bookmarkStore.addBookmark(bookmarks[1]);
        expect(bookmarkStore.bookmarks.length).toBe(2);
        bookmarkStore.addBookmark(bookmarks[2]);
        expect(bookmarkStore.bookmarks.length).toBe(3);

        expect(bookmarksService.getBookmarkId(projectRef, formRef, '')).toBe(11);
        expect(bookmarksService.getBookmarkId(projectRef + '0', formRef + '0', '')).toBe(null);
        expect(bookmarksService.getBookmarkId(projectRef, formRef, parentEntryUuid)).toBe(33);
        expect(bookmarksService.getBookmarkId(projectRef, formRef, parentEntryUuid + '-')).toBe(44);
    });

    it('returns bookmarks id (or null when no matching bookmark is found) (child form, 2 level)', () => {

        const bookmarkStore = useBookmarkStore();
        const parentEntryUuid = utilsService.uuid();
        const bookmarks = [
            {
                id: 2,
                projectRef: 'b963c3867b1441b89cb552b982f04bc8',
                formRef: 'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
                title: 'EC5 Demo Project',
                hierarchyNavigation: []
            },
            {
                id: 3,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_5784e69e88f5e',
                title: 'history',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ]
            },
            {
                id: 1,
                projectRef: '507372e7cdd546baa5df0b182cad4ebc',
                formRef: '507372e7cdd546baa5df0b182cad4ebc_64d3954955dc1',
                title: 'Test SEARCH',
                hierarchyNavigation: []
            },
            {
                id: 4,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
                title: 'Tim 6',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    },
                    {
                        parentEntryUuid: '6f1622a3-2ced-4539-bd81-c9d4fa20f150',
                        parentEntryName: 'Tim 6'
                    }
                ]
            }
        ];

        bookmarks.forEach((bookmark, index) => {
            bookmarkStore.addBookmark(bookmark);
            expect(bookmarkStore.bookmarks.length).toBe(index + 1);
        });

        expect(bookmarksService.getBookmarkId(
            'b963c3867b1441b89cb552b982f04bc8',
            'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
            '')
        ).toBe(2);
        expect(bookmarksService.getBookmarkId(projectRef + '0', formRef + '0', '')).toBe(null);
        expect(bookmarksService.getBookmarkId(
            '584ccf290bd547e38b4ccf7e27d03c77',
            '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
            '6f1622a3-2ced-4539-bd81-c9d4fa20f150')
        ).toBe(4);
    });

    it('returns bookmarks id (or null when no matching bookmark is found) (child form, 3 level)', () => {

        const bookmarkStore = useBookmarkStore();
        const parentEntryUuid = utilsService.uuid();
        const bookmarks = [
            {
                id: 2,
                projectRef: 'b963c3867b1441b89cb552b982f04bc8',
                formRef: 'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
                title: 'EC5 Demo Project',
                hierarchyNavigation: []
            },
            {
                id: 3,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_5784e69e88f5e',
                title: 'history',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ]
            },
            {
                id: 1,
                projectRef: '507372e7cdd546baa5df0b182cad4ebc',
                formRef: '507372e7cdd546baa5df0b182cad4ebc_64d3954955dc1',
                title: 'Test SEARCH',
                hierarchyNavigation: []
            },
            {
                id: 4,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
                title: 'Tim 6',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    },
                    {
                        parentEntryUuid: '6f1622a3-2ced-4539-bd81-c9d4fa20f150',
                        parentEntryName: 'Tim 6'
                    }
                ]
            }
        ];

        bookmarks.forEach((bookmark, index) => {
            bookmarkStore.addBookmark(bookmark);
            expect(bookmarkStore.bookmarks.length).toBe(index + 1);
        });

        expect(bookmarksService.getBookmarkId(
            'b963c3867b1441b89cb552b982f04bc8',
            'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
            '')
        ).toBe(2);
        expect(bookmarksService.getBookmarkId(projectRef + '0', formRef + '0', '')).toBe(null);
        expect(bookmarksService.getBookmarkId(
            '584ccf290bd547e38b4ccf7e27d03c77',
            '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
            '6f1622a3-2ced-4539-bd81-c9d4fa20f150')
        ).toBe(4);
    });

    it('returns bookmarks id (or null when no matching bookmark is found) (child form, 4 level)', () => {

        const bookmarkStore = useBookmarkStore();
        const parentEntryUuid = utilsService.uuid();
        const bookmarks = [
            {
                id: 2,
                projectRef: 'b963c3867b1441b89cb552b982f04bc8',
                formRef: 'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
                title: 'EC5 Demo Project',
                hierarchyNavigation: []
            },
            {
                id: 3,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_5784e69e88f5e',
                title: 'history',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ]
            },
            {
                id: 1,
                projectRef: '507372e7cdd546baa5df0b182cad4ebc',
                formRef: '507372e7cdd546baa5df0b182cad4ebc_64d3954955dc1',
                title: 'Test SEARCH',
                hierarchyNavigation: []
            },
            {
                id: 5,
                projectRef: '2be52d218a4b4b6a9fb84e7c83238300',
                formRef: '2be52d218a4b4b6a9fb84e7c83238300_64e63ffa50771',
                title: 'the page 4',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: 'a11ddfb5-7fd0-4af8-9775-7117b29033e5',
                        parentEntryName: 'sadsad'
                    },
                    {
                        parentEntryUuid: '57e0bbfa-2f36-49ea-bfb2-f749918487ff',
                        parentEntryName: 'assad'
                    },
                    {
                        parentEntryUuid: '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09',
                        parentEntryName: 'assadasdasd'
                    }
                ]
            },
            {
                id: 4,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
                title: 'Tim 6',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    },
                    {
                        parentEntryUuid: '6f1622a3-2ced-4539-bd81-c9d4fa20f150',
                        parentEntryName: 'Tim 6'
                    }
                ]
            }
        ];

        bookmarks.forEach((bookmark, index) => {
            bookmarkStore.addBookmark(bookmark);
            expect(bookmarkStore.bookmarks.length).toBe(index + 1);
        });

        expect(bookmarksService.getBookmarkId(
            'b963c3867b1441b89cb552b982f04bc8',
            'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
            '')
        ).toBe(2);
        expect(bookmarksService.getBookmarkId(projectRef + '0', formRef + '0', '')).toBe(null);
        expect(bookmarksService.getBookmarkId(
            '584ccf290bd547e38b4ccf7e27d03c77',
            '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
            '6f1622a3-2ced-4539-bd81-c9d4fa20f150')
        ).toBe(4);
        expect(bookmarksService.getBookmarkId(
            '2be52d218a4b4b6a9fb84e7c83238300',
            '2be52d218a4b4b6a9fb84e7c83238300_64e63ffa50771',
            '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09')
        ).toBe(5);
    });

    it('returns bookmarks id (or null when no matching bookmark is found) (child form, 5 level)', () => {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = [
            {
                id: 2,
                projectRef: 'b963c3867b1441b89cb552b982f04bc8',
                formRef: 'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
                title: 'EC5 Demo Project',
                hierarchyNavigation: []
            },
            {
                id: 3,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_5784e69e88f5e',
                title: 'history',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ]
            },
            {
                id: 1,
                projectRef: '507372e7cdd546baa5df0b182cad4ebc',
                formRef: '507372e7cdd546baa5df0b182cad4ebc_64d3954955dc1',
                title: 'Test SEARCH',
                hierarchyNavigation: []
            },
            {
                id: 6,
                projectRef: '2be52d218a4b4b6a9fb84e7c83238300',
                formRef: '2be52d218a4b4b6a9fb84e7c83238300_64e6400050772',
                title: 'The last one 5',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: 'a11ddfb5-7fd0-4af8-9775-7117b29033e5',
                        parentEntryName: 'sadsad'
                    },
                    {
                        parentEntryUuid: '57e0bbfa-2f36-49ea-bfb2-f749918487ff',
                        parentEntryName: 'assad'
                    },
                    {
                        parentEntryUuid: '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09',
                        parentEntryName: 'assadasdasd'
                    },
                    {
                        parentEntryUuid: '7e3181b4-6928-4da4-be41-25d6f7454c3b',
                        parentEntryName: '7e3181b4-6928-4da4-be41-25d6f7454c3b'
                    }
                ]
            },
            {
                id: 5,
                projectRef: '2be52d218a4b4b6a9fb84e7c83238300',
                formRef: '2be52d218a4b4b6a9fb84e7c83238300_64e63ffa50771',
                title: 'the page 4',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: 'a11ddfb5-7fd0-4af8-9775-7117b29033e5',
                        parentEntryName: 'sadsad'
                    },
                    {
                        parentEntryUuid: '57e0bbfa-2f36-49ea-bfb2-f749918487ff',
                        parentEntryName: 'assad'
                    },
                    {
                        parentEntryUuid: '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09',
                        parentEntryName: 'assadasdasd'
                    }
                ]
            },
            {
                id: 4,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
                title: 'Tim 6',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    },
                    {
                        parentEntryUuid: '6f1622a3-2ced-4539-bd81-c9d4fa20f150',
                        parentEntryName: 'Tim 6'
                    }
                ]
            }
        ];

        bookmarks.forEach((bookmark, index) => {
            bookmarkStore.addBookmark(bookmark);
            expect(bookmarkStore.bookmarks.length).toBe(index + 1);
        });

        expect(bookmarksService.getBookmarkId(
            'b963c3867b1441b89cb552b982f04bc8',
            'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
            '')
        ).toBe(2);
        expect(bookmarksService.getBookmarkId(projectRef + '0', formRef + '0', '')).toBe(null);
        expect(bookmarksService.getBookmarkId(
            '584ccf290bd547e38b4ccf7e27d03c77',
            '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
            '6f1622a3-2ced-4539-bd81-c9d4fa20f150')
        ).toBe(4);
        expect(bookmarksService.getBookmarkId(
            '2be52d218a4b4b6a9fb84e7c83238300',
            '2be52d218a4b4b6a9fb84e7c83238300_64e63ffa50771',
            '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09')
        ).toBe(5);
        expect(bookmarksService.getBookmarkId(
            '2be52d218a4b4b6a9fb84e7c83238300',
            '2be52d218a4b4b6a9fb84e7c83238300_64e6400050772',
            '7e3181b4-6928-4da4-be41-25d6f7454c3b')
        ).toBe(6);
        expect(bookmarksService.getBookmarkId(
            '2be52d218a4b4b6a9fb84e7c83238300',
            '2be52d218a4b4b6a9fb84e7c83238300_64e6400050772',
            '')
        ).toBe(null);
    });
});

describe('bookmarksService insertBookmark', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('should insert bookmark in the DB and update bookmarksStore', async () => {

        const rootStore = useRootStore();
        const bookmarkStore = useBookmarkStore();
        const title = 'I am the bookmark title';
        databaseInsertService.insertBookmark = vi.fn().mockResolvedValue({ insertId: 99 });

        //insert parent bookmark
        await bookmarksService.insertBookmark(projectRef, formRef, title);
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(1);
        expect(bookmarkStore.bookmarks[0]).toMatchObject({
            id: 99,
            projectRef,
            formRef,
            title,
            hierarchyNavigation: []
        });

        //insert child bookmark
        await flushPromises();
        rootStore.hierarchyNavigation = [
            {
                parentEntryUuid: 'a11ddfb5-7fd0-4af8-9775-7117b29033e5',
                parentEntryName: 'sadsad'
            },
            {
                parentEntryUuid: '57e0bbfa-2f36-49ea-bfb2-f749918487ff',
                parentEntryName: 'assad'
            },
            {
                parentEntryUuid: '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09',
                parentEntryName: 'assadasdasd'
            },
            {
                parentEntryUuid: '7e3181b4-6928-4da4-be41-25d6f7454c3b',
                parentEntryName: '7e3181b4-6928-4da4-be41-25d6f7454c3b'
            }
        ];
        await flushPromises();
        databaseInsertService.insertBookmark = vi.fn().mockResolvedValue({ insertId: 333 });
        await bookmarksService.insertBookmark(projectRef + 0, formRef + 0, title);
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(2);
        console.log(bookmarkStore.bookmarks);
        expect(bookmarkStore.bookmarks[1]).toMatchObject({
            id: 333,
            projectRef: projectRef + 0,
            formRef: formRef + 0,
            title,
            hierarchyNavigation: [...rootStore.hierarchyNavigation]
        });

    });
});

describe('bookmarksService deleteBookmark', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('should delete bookmark by its ID', async () => {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = [
            {
                id: 11,
                projectRef,
                formRef,
                title: 'The bookmark 1 title',
                hierarchyNavigation: []
            },
            {
                id: 22,
                projectRef: projectRef + '-',
                formRef: formRef + '-',
                title: 'The bookmark 2 title',
                hierarchyNavigation: []
            },
            {
                id: 33,
                projectRef: projectRef + '--',
                formRef: formRef + '--',
                title: 'The bookmark 3 title',
                hierarchyNavigation: []
            }
        ];

        bookmarkStore.addBookmark(bookmarks[0]);
        expect(bookmarkStore.bookmarks.length).toBe(1);
        bookmarkStore.addBookmark(bookmarks[1]);
        expect(bookmarkStore.bookmarks.length).toBe(2);
        bookmarkStore.addBookmark(bookmarks[2]);
        expect(bookmarkStore.bookmarks.length).toBe(3);

        databaseDeleteService.deleteBookmark = vi.fn().mockResolvedValue(true);

        await bookmarksService.deleteBookmark(11);
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(2);
        expect(bookmarksService.getBookmarkId(projectRef, formRef, '')).toBe(null);

        await bookmarksService.deleteBookmark(22);
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(1);
        expect(bookmarksService.getBookmarkId(projectRef + '-', formRef + '-', '')).toBe(null);

        await bookmarksService.deleteBookmark(33);
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(0);
        expect(bookmarksService.getBookmarkId(projectRef + '--', formRef + '--', '')).toBe(null);
    });
});

describe('bookmarksService getBookmarks', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('should delete bookmark by its ID', async () => {

        const bookmarkStore = useBookmarkStore();

        const mockRows = [
            {
                id: 1,
                project_ref: projectRef,
                form_ref: formRef,
                title: 'Bookmark 1',
                hierarchy_navigation: JSON.stringify([
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ])
            }
            // Add more mock rows as needed
        ];

        // Mock the behavior of databaseSelectService.selectBookmarks
        databaseSelectService.selectBookmarks = vi.fn().mockResolvedValue(
            {
                rows: {
                    length: mockRows.length,
                    item: (index) => mockRows[index]
                }
            });

        let bookmarks = await bookmarksService.getBookmarks();
        await flushPromises();
        expect(bookmarks.length).toBe(1);
        expect(bookmarks[0]).toMatchObject(
            {
                id: 1,
                projectRef,
                formRef,
                title: 'Bookmark 1',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ]
            }
        );

        mockRows.push(
            {
                id: 2,
                project_ref: projectRef + 0,
                form_ref: formRef + 0,
                title: 'Bookmark 2',
                hierarchy_navigation: JSON.stringify([
                    {
                        parentEntryUuid: '877e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'biology'
                    }
                ])
            }
        );
        expect(Array.isArray(bookmarks)).toBe(true);

        databaseSelectService.selectBookmarks = vi.fn().mockResolvedValue(
            {
                rows: {
                    length: mockRows.length,
                    item: (index) => mockRows[index]
                }
            });
        bookmarks = await bookmarksService.getBookmarks();
        await flushPromises();
        expect(bookmarks.length).toBe(2);
        expect(bookmarks[1]).toMatchObject(
            {
                id: 2,
                projectRef: projectRef + 0,
                formRef: formRef + 0,
                title: 'Bookmark 2',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '877e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'biology'
                    }
                ]
            }
        );
        expect(Array.isArray(bookmarks)).toBe(true);
    });
});

describe('bookmarksService deleteBookmarks', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('should delete all bookmarks of a project', async () => {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = [
            {
                id: 11,
                projectRef,
                formRef,
                title: 'The bookmark 1 title',
                hierarchyNavigation: []
            },
            {
                id: 22,
                projectRef: projectRef + '-',
                formRef: formRef + '-',
                title: 'The bookmark 2 title',
                hierarchyNavigation: []
            },
            {
                id: 33,
                projectRef: projectRef + '--',
                formRef: formRef + '--',
                title: 'The bookmark 3 title',
                hierarchyNavigation: []
            }
        ];

        bookmarkStore.addBookmark(bookmarks[0]);
        expect(bookmarkStore.bookmarks.length).toBe(1);
        bookmarkStore.addBookmark(bookmarks[1]);
        expect(bookmarkStore.bookmarks.length).toBe(2);
        bookmarkStore.addBookmark(bookmarks[2]);
        expect(bookmarkStore.bookmarks.length).toBe(3);

        databaseDeleteService.deleteBookmarks = vi.fn().mockResolvedValue(true);

        await bookmarksService.deleteBookmarks(projectRef);
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(2);
        expect(bookmarksService.getBookmarkId(projectRef, formRef, '')).toBe(null);

        await bookmarksService.deleteBookmarks(projectRef + '-');
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(1);
        expect(bookmarksService.getBookmarkId(projectRef + '-', formRef + '-', '')).toBe(null);

        await bookmarksService.deleteBookmarks(projectRef + '--');
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(0);
        expect(bookmarksService.getBookmarkId(projectRef + '--', formRef + '--', '')).toBe(null);
    });


});

describe('bookmarksService deleteBookmarksForEntry', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('should delete all bookmarks of an entry', async () => {

        const bookmarkStore = useBookmarkStore();
        const bookmarks = [
            {
                id: 2,
                projectRef: 'b963c3867b1441b89cb552b982f04bc8',
                formRef: 'b963c3867b1441b89cb552b982f04bc8_5784e0609397d',
                title: 'EC5 Demo Project',
                hierarchyNavigation: []
            },
            {
                id: 3,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_5784e69e88f5e',
                title: 'history',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    }
                ]
            },
            {
                id: 1,
                projectRef: '507372e7cdd546baa5df0b182cad4ebc',
                formRef: '507372e7cdd546baa5df0b182cad4ebc_64d3954955dc1',
                title: 'Test SEARCH',
                hierarchyNavigation: []
            },
            {
                id: 6,
                projectRef: '2be52d218a4b4b6a9fb84e7c83238300',
                formRef: '2be52d218a4b4b6a9fb84e7c83238300_64e6400050772',
                title: 'The last one 5',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: 'a11ddfb5-7fd0-4af8-9775-7117b29033e5',
                        parentEntryName: 'sadsad'
                    },
                    {
                        parentEntryUuid: '57e0bbfa-2f36-49ea-bfb2-f749918487ff',
                        parentEntryName: 'assad'
                    },
                    {
                        parentEntryUuid: '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09',
                        parentEntryName: 'assadasdasd'
                    },
                    {
                        parentEntryUuid: '7e3181b4-6928-4da4-be41-25d6f7454c3b',
                        parentEntryName: '7e3181b4-6928-4da4-be41-25d6f7454c3b'
                    }
                ]
            },
            {
                id: 5,
                projectRef: '2be52d218a4b4b6a9fb84e7c83238300',
                formRef: '2be52d218a4b4b6a9fb84e7c83238300_64e63ffa50771',
                title: 'the page 4',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: 'a11ddfb5-7fd0-4af8-9775-7117b29033e5',
                        parentEntryName: 'sadsad'
                    },
                    {
                        parentEntryUuid: '57e0bbfa-2f36-49ea-bfb2-f749918487ff',
                        parentEntryName: 'assad'
                    },
                    {
                        parentEntryUuid: '2e13cf25-ba6c-4fa2-96ec-dc429cc3ad09',
                        parentEntryName: 'assadasdasd'
                    }
                ]
            },
            {
                id: 4,
                projectRef: '584ccf290bd547e38b4ccf7e27d03c77',
                formRef: '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
                title: 'Tim 6',
                hierarchyNavigation: [
                    {
                        parentEntryUuid: '777e6745-d4d5-4277-ad89-2664be644f2c',
                        parentEntryName: 'history'
                    },
                    {
                        parentEntryUuid: '6f1622a3-2ced-4539-bd81-c9d4fa20f150',
                        parentEntryName: 'Tim 6'
                    }
                ]
            }
        ];

        bookmarks.forEach((bookmark, index) => {
            bookmarkStore.addBookmark(bookmark);
            expect(bookmarkStore.bookmarks.length).toBe(index + 1);
        });

        databaseDeleteService.deleteBookmark = vi.fn().mockResolvedValue(true);
        expect(bookmarkStore.bookmarks.length).toBe(bookmarks.length);

        // 2 bookmarks removed
        await bookmarksService.deleteBookmarksForEntry('777e6745-d4d5-4277-ad89-2664be644f2c');
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(4);


        // 2 bookmarks removed
        await bookmarksService.deleteBookmarksForEntry('6f1622a3-2ced-4539-bd81-c9d4fa20f150');
        await flushPromises();
        expect(bookmarkStore.bookmarks.length).toBe(4);
        expect(bookmarksService.getBookmarkId(
            '584ccf290bd547e38b4ccf7e27d03c77',
            '584ccf290bd547e38b4ccf7e27d03c77_5784e69e88f5e',
            '777e6745-d4d5-4277-ad89-2664be644f2c'
        )).toBe(null);
        expect(bookmarksService.getBookmarkId(
            '584ccf290bd547e38b4ccf7e27d03c77',
            '584ccf290bd547e38b4ccf7e27d03c77_584f0da7b0fea',
            '777e6745-d4d5-4277-ad89-2664be644f2c'
        )).toBe(null);
    });
});