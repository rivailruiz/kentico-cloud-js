import { IItemQueryConfig } from '../interfaces';
import { ContentItem, Link, TypeResolver } from '../models';
import { IHtmlResolverConfig, IRichTextHtmlParser } from '../parser';
import { stronglyTypedResolver } from './strongly-type.resolver';

export class RichTextResolver {

    /**
     * Resolves linked items inside the Rich text field.
     * Rich text resolved needs to be configured either on the model or query level
     */
    resolveHtml(
        html: string,
        data: {
            richTextHtmlParser: IRichTextHtmlParser,
            typeResolvers: TypeResolver[],
            linkedItems: ContentItem[],
            links: Link[],
            enableAdvancedLogging: boolean,
            queryConfig: IItemQueryConfig,
            linkedItemWrapperTag: string,
            linkedItemWrapperClasses: string[]
        }): string {
        // prepare config
        const config: IHtmlResolverConfig = {
            enableAdvancedLogging: data.enableAdvancedLogging,
            queryConfig: data.queryConfig,
            linkedItemWrapperTag: data.linkedItemWrapperTag,
            linkedItemWrapperClasses: data.linkedItemWrapperClasses
        };

        const result = data.richTextHtmlParser.resolveRichTextField(
            html, {
                getLinkResult: (itemId: string) => this.getLinkResult({
                    config: config,
                    links: data.links,
                    itemId: itemId,
                    typeResolvers: data.typeResolvers
                }),
                getLinkedItemHtml: (itemCodename: string) => this.getLinkedItemHtml({
                    itemCodename: itemCodename,
                    config: config,
                    linkedItems: data.linkedItems,
                })
            }, {
                enableAdvancedLogging: data.enableAdvancedLogging,
                queryConfig: data.queryConfig,
                linkedItemWrapperTag: data.linkedItemWrapperTag,
                linkedItemWrapperClasses: data.linkedItemWrapperClasses
            });

        return result.resolvedHtml;
    }

    private getLinkedItemHtml(data: {
        itemCodename: string,
        config: IHtmlResolverConfig,
        linkedItems: ContentItem[],
    }): string {
        // get linked item
        const linkedItem = data.linkedItems.find(m => m.system.codename === data.itemCodename);

        // check if linked item really exists
        if (!linkedItem) {
            throw Error(`Cannot resolve linked item html in 'RichTextField' for '${data.itemCodename}' linked item`);
        }

        // create new replacement object

        // get html to replace object using Rich text resolver function
        let resolver: (<TItem extends ContentItem>(item: TItem) => string) | undefined = undefined;
        if (data.config.queryConfig.richTextResolver) {
            // use resolved defined by query if available
            resolver = data.config.queryConfig.richTextResolver;
        } else {
            // use default resolver defined in models
            if (linkedItem.richTextResolver) {
                resolver = linkedItem.richTextResolver;
            }
        }

        // check resolver
        if (!resolver) {
            if (data.config.enableAdvancedLogging) {
                console.warn(`Cannot resolve html of '${linkedItem.system.type}' type in 'RichTextField' because no rich text resolved was configured`);
                return '';
            }
            return '';
        }
        return resolver(linkedItem);
    }

    private getLinkResult(data: {
        itemId: string,
        config: IHtmlResolverConfig,
        links: Link[],
        typeResolvers: TypeResolver[]
    }): string {
        // find link with the id of content item
        const link = data.links.find(m => m.itemId === data.itemId);

        if (!link) {
            if (data.config.enableAdvancedLogging) {
                console.warn(`Cannot resolve URL for item '${data.itemId}' because no link with this id was found`);
            }
            return '';
        }

        // try to resolve link using the resolver passed through the query config
        const queryLinkResolver = data.config.queryConfig.linkResolver;

        let url;

        if (queryLinkResolver) {
            // try to resolve url using the query config
            url = queryLinkResolver(link);
        }

        if (!url) {
            // url was not resolved, try to find global resolver for this particular type
            const emptyTypedItem = stronglyTypedResolver.createEmptyTypedObj<ContentItem>(link.type, data.typeResolvers);

            if (!emptyTypedItem) {
                if (data.config.enableAdvancedLogging) {
                    console.warn(`Cannot resolve link for link of '${link.type}' type with id '${link.itemId}' and url slug '${link.urlSlug}'`);
                }
            } else {
                const globalLinkResolver = emptyTypedItem.linkResolver;
                if (globalLinkResolver) {
                    url = globalLinkResolver(link);
                }
            }
        }

        // url still wasn't resolved
        if (!url) {
            if (data.config.enableAdvancedLogging) {
                console.warn(`Url for content type '${link.type}' with id '${link.itemId}' resolved to null/undefined`);
            }
            return '';
        }

        return url;
    }
}

export const richTextResolver = new RichTextResolver();
